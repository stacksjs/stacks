type TeamMemberName = string
type Email = string

export interface Team {
  [key: TeamMemberName]: Email
}
