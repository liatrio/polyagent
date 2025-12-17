# simple policy that allows admin users
package authz

default allow := false

allow if {
    input.user.role == "admin"
}
