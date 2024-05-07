import React from 'react';

export default function Button({children, onClick, className, disabled}) {
    return (
        <button onClick={onClick} className={`${className} ${disabled ? 'disabledbtn' : ''}`} disabled={disabled}>{children}</button>
    );
};
