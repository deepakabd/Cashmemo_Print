import { workspaceCommands } from '../utils/workspaceCommands';

const groups = [
  ['Bin', 'Control permanent deletion from the Bin.'],
  ['Register Report', 'Choose which actions and print buttons appear in the register report.'],
  ['Product', 'Choose which product columns appear in the catalogue.'],
];

export default function WorkspaceCommandSettings({ commands, onChange }) {
  return <section className="invoice-workspace__card invoice-command-settings">
    <h3>Show / Hide Commands</h3>
    <p>Toggle buttons and columns on or off. Preferences are saved for this dealer in this browser.</p>
    <div className="invoice-command-settings__groups">{groups.map(([group, description]) => <section key={group} className="invoice-command-settings__group" aria-label={`${group} visibility settings`}>
      <div className="invoice-command-settings__group-heading"><h4>{group === 'Register Report' ? 'Inventory & Cash Register Report' : group}</h4><p>{description}</p></div>
      <div className="invoice-command-settings__list">{workspaceCommands.filter(([, label]) => label.startsWith(`${group}:`)).map(([key, label]) => <label key={key}>
        <span>{label.split(': ')[1]}</span>
        <span className="invoice-command-settings__control"><span className={commands[key] ? 'is-visible' : ''} aria-hidden="true">{commands[key] ? 'Shown' : 'Hidden'}</span>
          <span className="invoice-command-settings__switch"><input type="checkbox" role="switch" aria-label={label} checked={commands[key]} onChange={(event) => onChange(key, event.target.checked)} /><span className="invoice-command-settings__track" aria-hidden="true" /></span>
        </span>
      </label>)}</div>
    </section>)}</div>
  </section>;
}
