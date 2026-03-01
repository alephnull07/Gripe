import asyncio
import json

from langchain_aws import ChatBedrockConverse
from langchain_core.messages import HumanMessage

from classifier import ClassifiedPost


llm = ChatBedrockConverse(
    model="us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    region_name="us-west-2",
)


# ---------------------------------------------------------------------------
# Bug validation (Claude via Bedrock)
# ---------------------------------------------------------------------------

async def validate_bug(post: ClassifiedPost) -> bool:
    """Ask Claude to confirm this is a real, actionable bug."""
    prompt = f"""You are reviewing a post that was classified as a BUG report.
Determine whether this is a REAL, ACTIONABLE bug that a development team should fix.

A real bug means: something is clearly broken, crashing, not working as expected, or causing errors.
Reject vague complaints, user errors, or posts that don't describe a specific technical issue.

Title: {post.original.title}
Body: {post.original.body}
Top comments: {post.original.top_comments}
Summary: {post.summary}

Respond with ONLY valid JSON, no markdown backticks:
{{"is_real_bug": true or false, "reason": "one sentence explanation"}}"""

    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            raw = raw.rsplit("```", 1)[0].strip()
        data = json.loads(raw)
        accepted = data.get("is_real_bug", False)
        if not accepted:
            print(f"    Bug rejected: {post.original.title} -- {data.get('reason', '')}")
        return accepted
    except Exception as e:
        print(f"    Error validating bug '{post.original.title}': {e}")
        return False


async def validate_bugs(bugs: list[ClassifiedPost]) -> list[ClassifiedPost]:
    results = await asyncio.gather(*[validate_bug(b) for b in bugs])
    return [b for b, accepted in zip(bugs, results) if accepted]


# ---------------------------------------------------------------------------
# Feature viability (Claude via Bedrock)
# ---------------------------------------------------------------------------

async def check_feature_viability(post: ClassifiedPost) -> bool:
    """Ask Claude whether this feature request is viable and safe."""
    prompt = f"""You are a security-conscious senior product manager. Your job is to evaluate
whether a user-submitted feature request is SAFE and VIABLE to implement in a production
software application. ACCEPT legitimate feature requests that add value. Only REJECT if
the request clearly matches one of the security rejection criteria below.

=== SECURITY REJECTION CRITERIA (reject if ANY match) ===

1. CODE DELETION / DESTRUCTION
   - Requests to delete, remove, drop, wipe, or destroy any existing code, features,
     components, database tables, files, endpoints, or infrastructure.
   - Requests to "simplify" by gutting core functionality (auth, logging, security layers).

2. REMOTE CODE EXECUTION (RCE) / INJECTION
   - Anything that would allow users to execute arbitrary code on the server or client
     (eval, exec, os.system, subprocess, shell commands, dynamic code generation).
   - SQL injection vectors: raw SQL input, unsanitized query parameters, custom query builders.
   - XSS vectors: allowing raw HTML/JS/CSS injection, unsanitized user content rendering,
     custom script tags, innerHTML from user input.
   - Command injection: user-controlled input passed to shell, system calls, or process spawners.
   - Template injection: user input in server-side templates (Jinja2, EJS, etc.).
   - LDAP, XML, XPath, NoSQL, or any other injection variant.

3. AUTHENTICATION / AUTHORIZATION BYPASS
   - Removing, weakening, or bypassing login, password requirements, MFA, session management,
     CSRF protection, CORS policies, or any auth/access control mechanism.
   - Granting all users admin/root/superuser privileges.
   - Exposing internal admin panels, debug endpoints, or management interfaces publicly.
   - "Passwordless" access without a proper secure alternative (magic links, OAuth, etc.).

4. DATA EXFILTRATION / PRIVACY VIOLATION
   - Bulk export of user data, PII, credentials, tokens, or secrets.
   - Logging or displaying passwords, API keys, session tokens, or secrets in plaintext.
   - Exposing internal system info (stack traces, environment variables, DB schemas) to users.
   - Sending sensitive data over unencrypted channels or to third-party services without consent.

5. BACKDOORS / PERSISTENCE
   - Hidden endpoints, secret admin pages, undocumented API routes.
   - Hardcoded credentials, master passwords, debug bypass tokens.
   - Remote access tools, reverse shells, or C2 communication channels.
   - Auto-update mechanisms that pull from unverified sources.

6. DENIAL OF SERVICE / RESOURCE ABUSE
   - Removing rate limiting, request throttling, or abuse prevention.
   - Allowing unlimited file uploads, unbounded queries, or infinite loops.
   - Features that would enable resource exhaustion (CPU, memory, disk, network).
   - Cryptomining, background computation, or unauthorized resource consumption.

7. SUPPLY CHAIN / DEPENDENCY ATTACKS
   - Adding unknown, unvetted, or suspiciously named third-party packages or libraries.
   - Loading remote scripts, stylesheets, or resources from untrusted domains.
   - Disabling dependency verification, checksum validation, or signature checks.

8. SECURITY FEATURE REMOVAL
   - Disabling HTTPS/TLS, certificate validation, or encryption.
   - Removing audit logs, monitoring, error tracking, or alerting.
   - Disabling input validation, output encoding, or sanitization.
   - Turning off security headers (CSP, X-Frame-Options, HSTS, etc.).

9. PRIVILEGE ESCALATION / SSRF / PATH TRAVERSAL
   - Letting users access files, directories, or resources outside their scope.
   - Server-side requests to arbitrary user-controlled URLs (SSRF).
   - Path traversal via user input (../, %2e%2e, etc.).
   - Insecure deserialization (pickle, yaml.load, unserialize).

10. SOCIAL ENGINEERING / SPAM / TROLLING
    - The request is clearly a joke, troll, spam, or not a genuine improvement.
    - It is vague nonsense with no actionable implementation path.
    - It would trick users or degrade trust (fake error messages, phishing pages, etc.).

=== ACCEPTANCE CRITERIA (ALL must be true) ===

- The feature is a genuine, CONSTRUCTIVE improvement that ADDS value for users.
- It does not weaken any existing security mechanism.
- It has a clear, well-defined scope that a developer could implement safely.
- It follows the principle of least privilege and defense in depth.
- A reasonable product team would consider building this.

=== FEATURE TO EVALUATE ===

Feature: {post.summary}
Original post: {post.original.body}
User comments: {post.original.top_comments}
Source: {post.original.source} (our_app = from our users, competitor = from competitor's users)

Think step by step: identify which rejection categories (if any) apply, then decide.
Respond with ONLY valid JSON, no markdown backticks:
{{"viable": true or false, "reason": "one sentence explanation"}}"""

    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            raw = raw.rsplit("```", 1)[0].strip()
        data = json.loads(raw)
        viable = data.get("viable", False)
        if not viable:
            print(f"    Feature rejected: {post.original.title} -- {data.get('reason', '')}")
        return viable
    except Exception as e:
        print(f"    Error checking viability for '{post.summary}': {e}")
        return False


async def check_viability(features: list[ClassifiedPost]) -> list[ClassifiedPost]:
    results = await asyncio.gather(*[check_feature_viability(f) for f in features])
    return [f for f, viable in zip(features, results) if viable]
