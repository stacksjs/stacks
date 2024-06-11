import { List } from '@raycast/api'
import { useState } from 'react'
import { DetailsView } from './components/DetailsView'
import { VersionSelect } from './components/VersionSelect'
import { useCommands } from './hooks/useCommands'
import { useVersions } from './hooks/useVersions'

export default function Buddy() {
  const [version, setVersion] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState<string | undefined>(undefined)
  const { versions } = useVersions()
  const { commands, isLoading } = useCommands({ version, search })

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      onSearchTextChange={setSearch}
      throttle={true}
      searchBarPlaceholder="Search for a buddy command..."
      searchBarAccessory={<VersionSelect versions={versions} setVersion={setVersion} />}
    >
      {commands?.map((command) => (
        <List.Item
          title={command.signature}
          key={command.signature + (search ?? '')}
          icon={{ source: 'stacks-logo.ico' }}
          detail={<DetailsView command={command} />}
        />
      ))}
    </List>
  )
}
