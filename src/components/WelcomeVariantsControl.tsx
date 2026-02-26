import React, {useCallback} from 'react';
import {Link} from 'react-router-dom';
import clsx from 'clsx';
import './css/welcomeVariantsControl.css';
// @ts-ignore
import swal from '@sweetalert/with-react';

export const WelcomeVariantsControl: React.FC<{
  fencing?: boolean;
}> = (props) => {
  const showFencingInfo = useCallback(() => {
    swal({
      title: 'crosswithfriends.com/fencing',
      icon: 'info',
      content: (
        <div className="swal-text swal-text--no-margin">
          <p>
            Fencing is a variant of Cross with Friends where you can race to complete a crossword against
            friends in real time.
            <br />
            <br />
            Quickly fill in cells correctly before the other team to unlock more clues and explore the grid.
            <br />
            <br />
            <span style={{fontSize: '75%', color: 'gray'}}>
              Join the&nbsp;
              <a href="https://discord.gg/RmjCV8EZ73" target="_blank" rel="noreferrer">
                community Discord
              </a>
              &nbsp;for more discussion.
            </span>
          </p>
        </div>
      ),
    });
  }, []);
  const handleFencingInfoKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        showFencingInfo();
      }
    },
    [showFencingInfo]
  );
  return (
    <div className="welcome-variants">
      <span className="welcome-variants--title">Variants</span>
      <Link to="/">
        <span
          className={clsx('welcome-variants--option', {
            selected: !props.fencing,
          })}
        >
          Normal
        </span>
      </Link>
      <span>
        <Link to="/fencing">
          <span
            className={clsx('welcome-variants--option', {
              selected: !!props.fencing,
            })}
          >
            Fencing
          </span>
        </Link>
        <span
          className="nav--info"
          onClick={showFencingInfo}
          onKeyDown={handleFencingInfoKeyDown}
          role="button"
          tabIndex={0}
        >
          <i className="fa fa-info-circle" />
        </span>
      </span>
    </div>
  );
};
