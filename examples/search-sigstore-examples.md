# Searching for Sigstore Policy Examples

This tutorial shows how to use the `search_policy_examples` tool to find Sigstore-related OPA policies for container image signature verification.

## What is Sigstore?

Sigstore is a set of tools for signing, verifying, and protecting software artifacts. When working with container security, you'll often need OPA policies that verify Sigstore signatures before allowing images to run.

## Basic Sigstore Search

Ask your AI assistant to search for Sigstore policies:

```
Search for Sigstore signature verification policies
```

The `search_policy_examples` tool will be invoked with:

```json
{
  "query": "Sigstore signature verification policies"
}
```

### Expected Results

You'll receive policy examples like:

```json
{
  "results": [
    {
      "repo": "sigstore-policy-controller",
      "path": "policies/verify-signature.rego",
      "snippet": "package sigstore.verify\n\ndefault allow = false\n\nallow {\n  input.image.signatures[_].issuer == \"https://accounts.google.com\"\n  input.image.signatures[_].subject == input.expected_identity\n}",
      "description": "Verify container image signatures using Sigstore",
      "tags": ["sigstore", "container", "security", "supply-chain"],
      "similarityScore": 0.89
    }
  ],
  "totalFound": 1
}
```

## More Specific Queries

### Keyless Signing Verification

```
Find policies for Sigstore keyless signing with OIDC identity verification
```

### Cosign Integration

```
Search for OPA policies that verify cosign signatures on container images
```

### Attestation Verification

```
Find Sigstore attestation verification policies for SLSA provenance
```

## Query Tips

1. **Include "Sigstore"** in your query for signature-related policies
2. **Add context** like "container", "image", or "verification" 
3. **Mention specific tools** like "cosign" or "fulcio" for targeted results
4. **Combine with frameworks** like "SLSA" for supply chain policies

## Example Conversation

**You:** I need to write an OPA policy that verifies container images are signed with Sigstore before deployment to Kubernetes.

**AI Assistant:** Let me search for relevant policy examples...

*[Uses search_policy_examples with query: "Sigstore container image verification Kubernetes admission"]*

**AI Assistant:** I found several relevant examples. Here's a policy pattern from the sigstore-policy-controller repo that verifies signatures...

## Related Topics

- [SLSA Provenance Examples](search-slsa-examples.md) - Supply chain security policies
- [RBAC Examples](search-rbac-examples.md) - Role-based access control patterns
