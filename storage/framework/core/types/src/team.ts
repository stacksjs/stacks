type TeamMemberName = string
type Email = string
type TeamMembers = Record<TeamMemberName, Email>

export interface Team {
  name: string
  members?: TeamMembers
}
