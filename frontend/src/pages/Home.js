import React from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import HeroBanner from '../components/HeroBanner';

/**
 * The association's existing resident portal, run by Taylor Management on
 * Enumerate Engage. Documents, payments, the calendar and the directory all
 * still live there and are maintained there -- these links hand residents
 * straight to them rather than this site keeping a second, staler copy.
 *
 * Only paths confirmed from the portal itself are listed. Adding a guessed one
 * would give residents a dead link, which is worse than a missing one.
 */
const PORTAL = 'https://engage.goenumerate.com/s/townsquarevillage';

const PORTAL_LINKS = [
  { label: 'News & events', href: `${PORTAL}/communityfeed.php` },
  { label: 'Documents & payments', href: `${PORTAL}/myhoaresources.php` },
  { label: 'Amenities', href: `${PORTAL}/publichoa.php` },
  { label: 'Resident portal', href: `${PORTAL}/home.php` },
];

/**
 * The public front door. Everything else in the app is behind a login, so this
 * is the only page a resident sees before they have an account -- it has to say
 * who the association is and give them one obvious thing to do.
 *
 * The hero is a drawn banner rather than a photograph, so it stays sharp at
 * any width and sits at its own size instead of being stretched to fill.
 */
export default function Home() {
  const { user } = useAuth();

  return (
    <div className="home">
      <header className="home-bar">
        <nav className="home-bar-inner" aria-label="Main">
          <div className="home-links">
            {PORTAL_LINKS.map((link) => (
              <a
                key={link.href}
                className="home-link-out"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
                <span className="home-out" aria-hidden="true">&#8599;</span>
              </a>
            ))}
          </div>

          <div className="home-actions">
            {user ? (
              <Link to="/dashboard" className="home-btn home-btn-primary">My requests</Link>
            ) : (
              <>
                <Link to="/login" className="home-link">Sign in</Link>
                <Link to="/register" className="home-btn home-btn-primary">Submit a request</Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <div className="home-hero">
        <HeroBanner />
      </div>

      <main className="home-main">
        <div className="home-grid">
          <section className="home-welcome">
            <h1 className="home-welcome-title">Welcome to Townsquare Village HOA, Inc.</h1>
            <p>
              Townsquare Village HOA, Inc. is dedicated to ensuring the beauty, safety and
              stability of the area, promoting neighborliness and pride among the residents,
              and forming a base for representation in matters affecting the community.
            </p>
            <p>
              This site provides services to residents of Townsquare Village HOA, Inc.,
              located in Rockaway, New Jersey.
            </p>

            <div className="home-cta">
              <h3>Something need fixing?</h3>
              <p>
                Report a maintenance issue and follow it through to resolution. You will see
                its status, who is handling it and every update along the way.
              </p>
              {user ? (
                <Link to="/tickets/new" className="home-btn home-btn-primary home-btn-lg">
                  Submit a request
                </Link>
              ) : (
                <div className="home-cta-actions">
                  <Link to="/register" className="home-btn home-btn-primary home-btn-lg">
                    Submit a request
                  </Link>
                  <Link to="/login" className="home-btn home-btn-quiet home-btn-lg">
                    I already have an account
                  </Link>
                </div>
              )}
            </div>
          </section>

          <aside className="home-aside">
            <div className="home-card">
              <h3>Association office</h3>
              <p className="home-card-strong">Townsquare Village HOA, Inc.</p>
              <p>
                129 Pondview Terrace
                <br />
                Rockaway, New Jersey 07866
              </p>
              <p>
                <a href="mailto:office@townsquarevillagenj.com">
                  office@townsquarevillagenj.com
                </a>
              </p>
            </div>

            <div className="home-card">
              <h3>Association resources</h3>
              <ul className="home-reslist">
                <li>
                  <a href={`${PORTAL}/myhoaresources.php`} target="_blank" rel="noopener noreferrer">
                    Documents &amp; governing rules
                  </a>
                </li>
                <li>
                  <a href={`${PORTAL}/myhoaresources.php`} target="_blank" rel="noopener noreferrer">
                    Make a payment
                  </a>
                </li>
                <li>
                  <a href={`${PORTAL}/communityfeed.php`} target="_blank" rel="noopener noreferrer">
                    Board meetings &amp; news
                  </a>
                </li>
                <li>
                  <a href={`${PORTAL}/communityfeed.php`} target="_blank" rel="noopener noreferrer">
                    Calendar &amp; committees
                  </a>
                </li>
                <li>
                  <a href={`${PORTAL}/publichoa.php`} target="_blank" rel="noopener noreferrer">
                    Amenities
                  </a>
                </li>
              </ul>
              <p className="home-reslist-note">
                Hosted on the association&rsquo;s resident portal, managed by Taylor Management.
              </p>
            </div>

            <div className="home-card">
              <h3>How requests work</h3>
              <ol className="home-steps">
                <li>Submit your request with a category and location.</li>
                <li>Management reviews it and assigns someone.</li>
                <li>You can comment, and you see every status change.</li>
                <li>It closes when the work is done.</li>
              </ol>
            </div>
          </aside>
        </div>
      </main>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <span>Townsquare Village HOA, Inc. &middot; Rockaway, New Jersey</span>
          <span>
            <a href="mailto:office@townsquarevillagenj.com">Contact the office</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
