import React, {useCallback} from 'react';
import {useToggle} from '../../hooks/useToggle';
import {PALETTE_COLORS} from '../../lib/colorAssignment';

interface ColorPickerProps {
  color: string;
  onUpdateColor: (color: string) => void;
}
const ColorPicker: React.FC<ColorPickerProps> = (props) => {
  const [isActive, toggleIsActive] = useToggle(false);
  const handleToggle = useCallback(() => {
    toggleIsActive();
  }, [toggleIsActive]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        toggleIsActive();
      }
    },
    [toggleIsActive]
  );
  const handleSwatchClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const color = e.currentTarget.dataset.color!;
      if (color !== props.color) {
        props.onUpdateColor(color);
      }
      toggleIsActive(false);
    },
    [props, toggleIsActive]
  );
  return (
    <>
      <span
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        style={{color: props.color, cursor: 'pointer'}}
      >
        {' '}
        {'\u25CF '}
      </span>
      {isActive ? (
        <>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0'}}>
            {PALETTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Select color ${c}`}
                data-color={c}
                onClick={handleSwatchClick}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: c,
                  border: c === props.color ? '2px solid #fff' : 'none',
                  boxShadow: c === props.color ? '0 0 0 2px #333' : 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
          <br />
        </>
      ) : null}
    </>
  );
};
export default ColorPicker;
