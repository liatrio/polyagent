# Tutorial: Debugging "Why Was This Request Denied?"

This tutorial demonstrates how to use PolyAgent's `explain_policy_decision` tool to understand why an OPA policy denied a request.

## The Scenario

You have an RBAC (Role-Based Access Control) policy that controls access to documents. A user named "alice" with the role "viewer" is trying to write to a document, but the request is being denied. You want to understand exactly why.

## The Policy

We'll use the simple RBAC policy from `examples/policies/rbac-simple.rego`:

```rego
package rbac

import rego.v1

# Default deny - if no rule explicitly allows, access is denied
default allow := false

# Admin role: full access
allow if {
    input.user.role == "admin"
}

# Editor role: can read and write documents
allow if {
    input.user.role == "editor"
    input.action in ["read", "write"]
    input.resource.type == "document"
}

# Viewer role: read-only access
allow if {
    input.user.role == "viewer"
    input.action == "read"
    input.resource.type == "document"
}
```

## The Denied Request

Alice (a viewer) tries to write to a document:

```json
{
  "user": {
    "name": "alice",
    "role": "viewer"
  },
  "action": "write",
  "resource": {
    "type": "document",
    "id": "doc-123"
  }
}
```

## Asking the AI: "Why Did This Deny?"

With PolyAgent connected to your AI assistant, you can ask conversationally:

> "I have a user alice with role viewer trying to write to a document. Can you explain why the policy at `examples/policies/rbac-simple.rego` denied this request?"

The AI will use the `explain_policy_decision` tool to evaluate the policy and show you exactly what happened.

## Understanding the Response

The `explain_policy_decision` tool returns a detailed trace of the evaluation:

```json
{
  "result": false,
  "trace": [
    { "rule": "allow", "line": 21, "result": "false" },
    { "rule": "allow", "line": 27, "result": "false" },
    { "rule": "allow", "line": 35, "result": "false" }
  ]
}
```

### What This Tells Us

1. **Result is `false`** - The `allow` rule evaluated to false, meaning access is denied.

2. **Three `allow` rules were evaluated:**
   - **Line 21 (admin check)**: Failed because `input.user.role == "admin"` is false (alice is a viewer, not admin)
   - **Line 27 (editor check)**: Failed because `input.user.role == "editor"` is false (alice is a viewer)
   - **Line 35 (viewer check)**: Failed because while alice IS a viewer, the rule requires `input.action == "read"`, but alice is trying to `"write"`

3. **No rule matched**, so the **default deny** took effect.

### The Root Cause

The request was denied because:
- Alice has the "viewer" role
- Viewers can only "read" documents (line 35-39 in the policy)
- Alice tried to "write", which viewers are not allowed to do
- Since no `allow` rule returned true, the `default allow := false` kicked in

## Fixing the Issue

Now that you understand why the deny happened, you have options:

1. **Change the request**: Alice should request "read" instead of "write"
2. **Upgrade the role**: Change Alice's role to "editor" if she needs write access
3. **Modify the policy**: Add write permission for viewers (not recommended for security)

## Try It Yourself

1. Start PolyAgent with your AI assistant
2. Ask: "Evaluate the policy at examples/policies/rbac-simple.rego with this input: `{\"user\": {\"role\": \"viewer\"}, \"action\": \"write\", \"resource\": {\"type\": \"document\"}}`"
3. Compare a successful request: change `"action": "read"` and see the difference

## Key Takeaways

- The `explain_policy_decision` tool shows exactly which rules were evaluated
- The trace includes line numbers so you can find rules in your policy file
- Understanding "default deny" behavior is crucial for debugging
- Looking at which conditions failed helps identify the root cause
