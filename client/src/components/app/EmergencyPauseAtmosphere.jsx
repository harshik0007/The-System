import CrimsonStasisAtmosphere from './CrimsonStasisAtmosphere.jsx';
import ThemeEmergencyPauseAtmosphere from './ThemeEmergencyPauseAtmosphere.jsx';

const THEMED_ATMOSPHERES = new Set(['obsidian', 'aurora', 'eclipse', 'galaxion']);

export default function EmergencyPauseAtmosphere(props) {
  if (THEMED_ATMOSPHERES.has(props.theme)) {
    return <ThemeEmergencyPauseAtmosphere {...props} />;
  }
  return <CrimsonStasisAtmosphere {...props} />;
}
