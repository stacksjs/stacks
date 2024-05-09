import ace from 'ace-builds'
import extSearchboxUrl from 'ace-builds/src-noconflict/ext-searchbox?url'
import modeHtmlUrl from 'ace-builds/src-noconflict/mode-html?url'
import modeJavascriptUrl from 'ace-builds/src-noconflict/mode-javascript?url'
import modeJsonUrl from 'ace-builds/src-noconflict/mode-json?url'
import modeMarkdownUrl from 'ace-builds/src-noconflict/mode-markdown?url' // Import Markdown mode
import modeShUrl from 'ace-builds/src-noconflict/mode-sh?url'
import modeTypescriptUrl from 'ace-builds/src-noconflict/mode-typescript?url'
import modeYamlUrl from 'ace-builds/src-noconflict/mode-yaml?url'
import snippetsHtmlUrl from 'ace-builds/src-noconflict/snippets/html?url'
import snippetsJsUrl from 'ace-builds/src-noconflict/snippets/javascript?url'
import snippetsJsonUrl from 'ace-builds/src-noconflict/snippets/json?url'
import snippetsYamlUrl from 'ace-builds/src-noconflict/snippets/yaml?url'
import themeChromeUrl from 'ace-builds/src-noconflict/theme-chrome?url'
import themeGithubUrl from 'ace-builds/src-noconflict/theme-github?url'
import themeGithubDarkUrl from 'ace-builds/src-noconflict/theme-github_dark?url'
import themeMonokaiUrl from 'ace-builds/src-noconflict/theme-monokai?url'
import themeNordDarkUrl from 'ace-builds/src-noconflict/theme-nord_dark?url'
import workerBaseUrl from 'ace-builds/src-noconflict/worker-base?url'
import workerHtmlUrl from 'ace-builds/src-noconflict/worker-html?url'
import workerJavascriptUrl from 'ace-builds/src-noconflict/worker-javascript?url'
import workerJsonUrl from 'ace-builds/src-noconflict/worker-json?url'
import workerYamlUrl from 'ace-builds/src-noconflict/worker-yaml?url'
import 'ace-builds/src-noconflict/ext-language_tools'

ace.config.setModuleUrl('ace/mode/json', modeJsonUrl)
ace.config.setModuleUrl('ace/mode/javascript', modeJavascriptUrl)
ace.config.setModuleUrl('ace/mode/typescript', modeTypescriptUrl)
ace.config.setModuleUrl('ace/mode/html', modeHtmlUrl)
ace.config.setModuleUrl('ace/mode/yaml', modeYamlUrl)
ace.config.setModuleUrl('ace/mode/sh', modeShUrl)
ace.config.setModuleUrl('ace/theme/github', themeGithubUrl)
ace.config.setModuleUrl('ace/theme/github_dark', themeGithubDarkUrl)
ace.config.setModuleUrl('ace/theme/chrome', themeChromeUrl)
ace.config.setModuleUrl('ace/theme/monokai', themeMonokaiUrl)
ace.config.setModuleUrl('ace/theme/nord_dark', themeNordDarkUrl)
ace.config.setModuleUrl('ace/mode/base', workerBaseUrl)
ace.config.setModuleUrl('ace/mode/json_worker', workerJsonUrl)
ace.config.setModuleUrl('ace/mode/javascript_worker', workerJavascriptUrl)
ace.config.setModuleUrl('ace/mode/typescript_worker', workerJavascriptUrl)
ace.config.setModuleUrl('ace/mode/html_worker', workerHtmlUrl)
ace.config.setModuleUrl('ace/mode/yaml_worker', workerYamlUrl)
ace.config.setModuleUrl('ace/mode/markdown', modeMarkdownUrl)
ace.config.setModuleUrl('ace/snippets/html', snippetsHtmlUrl)
ace.config.setModuleUrl('ace/snippets/javascript', snippetsJsUrl)
ace.config.setModuleUrl('ace/snippets/javascript', snippetsYamlUrl)
ace.config.setModuleUrl('ace/snippets/json', snippetsJsonUrl)
ace.config.setModuleUrl('ace/ext/searchbox', extSearchboxUrl)

ace.require('ace/ext/language_tools')
