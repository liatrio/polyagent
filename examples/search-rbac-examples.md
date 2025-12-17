# Searching for RBAC Policy Examples

This tutorial shows how to use the `search_policy_examples` tool to find role-based access control (RBAC) policies, including how to filter results to specific repositories.

## What is RBAC?

Role-Based Access Control (RBAC) is a security model where permissions are assigned to roles, and users are assigned to roles. OPA policies implementing RBAC are common in API authorization, Kubernetes admission control, and application security.

## Basic RBAC Search

Ask your AI assistant to search for RBAC policies:

```
Search for RBAC authorization policies
```

The `search_policy_examples` tool will be invoked with:

```json
{
  "query": "RBAC authorization policies"
}
```

### Expected Results

```json
{
  "results": [
    {
      "repo": "opa-library",
      "path": "authz/rbac.rego",
      "snippet": "package authz.rbac\n\ndefault allow = false\n\nallow {\n  user_has_role[role]\n  role_has_permission[role][input.action]\n}",
      "description": "Role-based access control with role-permission mapping",
      "tags": ["rbac", "authorization", "security"],
      "similarityScore": 0.92
    }
  ],
  "totalFound": 1
}
```

## Using the filterRepo Parameter

The `filterRepo` parameter lets you restrict results to a specific repository. This is useful when you want examples from a trusted source.

### Example: Filter to Liatrio Examples

```
Search for Kubernetes RBAC policies from the liatrio repository
```

The tool invocation includes `filterRepo`:

```json
{
  "query": "Kubernetes RBAC policies",
  "filterRepo": "liatrio"
}
```

### Example: Filter to Styra Library

```json
{
  "query": "API authorization RBAC",
  "filterRepo": "styra-library"
}
```

## Adjusting Result Count

Use the `limit` parameter to control how many results you receive (1-10, default 3):

```json
{
  "query": "RBAC policies",
  "limit": 5
}
```

## More Specific Queries

### Kubernetes RBAC

```
Find OPA policies for Kubernetes namespace-based RBAC
```

### API Gateway Authorization

```
Search for RBAC policies for REST API authorization with JWT claims
```

### Hierarchical Roles

```
Find RBAC policies with role inheritance and hierarchy
```

### Attribute-Based Extensions

```
Search for ABAC policies that extend RBAC with resource attributes
```

## Query Tips

1. **Be specific about the domain** - "Kubernetes RBAC" vs generic "RBAC"
2. **Include the action type** - "read/write permissions", "API authorization"
3. **Use filterRepo** when you want examples from a specific source
4. **Mention patterns** like "role hierarchy" or "permission inheritance"

## Example Conversation

**You:** I need to implement RBAC for our internal API. Users have roles like admin, editor, and viewer.

**AI Assistant:** Let me find some RBAC policy examples...

*[Uses search_policy_examples with query: "API RBAC admin editor viewer roles"]*

**AI Assistant:** Here are some relevant patterns. This example from the opa-library shows a clean role-permission mapping approach...

**You:** Can you find examples specifically from Styra's library?

**AI Assistant:** Sure, let me filter to that repository...

*[Uses search_policy_examples with query: "API RBAC", filterRepo: "styra-library"]*

## Related Topics

- [Sigstore Examples](search-sigstore-examples.md) - Container signature verification
- [SLSA Examples](search-slsa-examples.md) - Supply chain security policies
