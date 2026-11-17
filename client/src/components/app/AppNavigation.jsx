import { NavLink } from 'react-router-dom';
import { applicationNavigation } from '../../data/applicationNavigation.js';
import AppIcon from './AppIcon.jsx';

export default function AppNavigation({ collapsed = false, onNavigate = () => {} }) {
  return (
    <nav className="app-navigation" aria-label="Application navigation">
      {applicationNavigation.map((group) => (
        <section className="app-navigation__group" key={group.title} aria-label={group.title}>
          <h2 className="app-navigation__group-title">{group.title}</h2>
          <ul>
            {group.items.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end
                  className={({ isActive }) => `app-navigation__link${isActive ? ' is-active' : ''}`}
                  aria-label={item.label}
                  title={collapsed ? item.label : undefined}
                  onClick={onNavigate}
                >
                  <AppIcon name={item.icon} className="app-navigation__icon" />
                  <span className="app-navigation__label">{item.label}</span>
                  {item.id === 'dashboard' && <span className="app-navigation__active-mark" aria-hidden="true" />}
                </NavLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
