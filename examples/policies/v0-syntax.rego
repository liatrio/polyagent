# rego policy with different package name for testing
package authz_alt

default allow := false

allow if {
    input.user.role == "admin"
}
