import { Link, useLocation } from 'react-router-dom';
import { applicationNavigationItems } from '../../data/applicationNavigation.js';
import AppIcon from '../../components/app/AppIcon.jsx';

export default function AppPlaceholderPage() {
  const location = useLocation();
  const page = applicationNavigationItems.find((item) => item.path === location.pathname);
  const title = page?.label || 'Application area';

  return (
    <section className="app-placeholder" aria-labelledby="app-placeholder-title">
      <p className="app-eyebrow">PLANNED FOR A FUTURE MILESTONE</p>
      <span className="app-placeholder__icon"><AppIcon name={page?.icon || 'spark'} /></span>
      <h1 id="app-placeholder-title">{title}</h1>
      <p>{page?.description || 'This application area is planned for a future milestone.'}</p>
      <p className="app-placeholder__note">This preview does not read or save account data.</p>
      <Link className="app-action-link" to="/app/dashboard">Return to Dashboard <AppIcon name="arrow" /></Link>
    </section>
  );
}
