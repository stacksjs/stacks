import * as p from '@clack/prompts';
import { setTimeout } from 'node:timers/promises';
import color from 'picocolors';

async function main() {
	console.clear();

	await setTimeout(1000);

	p.intro(`Stacks ${color.bgCyan(color.black(' create-app '))}`);

  const defaultFolderPath = './stacks';

	const project = await p.group(
		{
			path: () =>
				p.text({
					message: 'Where should we create your project?',
					placeholder: defaultFolderPath,
					validate: (value = defaultFolderPath) => {
						// if (!value) return 'Please enter aq path.';
						if (value[0] !== '.') return 'Please enter a relative path.';
					},
				}),
			type: ({ results }) =>
				p.select({
					message: `Pick a project type within "${results.path}"`,
					initialValue: 'default',
					maxItems: 3,
					options: [
						{ value: 'default', label: 'Default (UI with API)' },
						{ value: 'ui', label: 'UI' },
						{ value: 'api', label: 'API' },
					],
				}),
			tools: () =>
				p.multiselect({
					message: 'Select additional tools.',
					initialValues: ['prettier', 'eslint'],
					options: [
						{ value: 'prettier', label: 'Prettier', hint: 'recommended' },
						{ value: 'eslint', label: 'ESLint', hint: 'recommended' },
						{ value: 'stylelint', label: 'Stylelint' },
						{ value: 'gh-action', label: 'GitHub Action' },
					],
				}),
			install: () =>
				p.confirm({
					message: 'Install dependencies?',
					initialValue: false,
				}),
		},
		{
			onCancel: () => {
				p.cancel('Operation cancelled.');
				process.exit(0);
			},
		}
	);

	if (project.install) {
		const s = p.spinner();
		s.start('Installing via pnpm');
		await setTimeout(2500);
		s.stop('Installed via pnpm');
	}

	let nextSteps = `cd ${project.path}        \n${project.install ? '' : 'pnpm install\n'}pnpm dev`;

	p.note(nextSteps, 'Next steps.');

	p.outro(`Problems? ${color.underline(color.cyan('https://example.com/issues'))}`);
}

main().catch(console.error);
