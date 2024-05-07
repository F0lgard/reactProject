import React from 'react'
import Games from './Games';

export default function GamesSection() {

    return(
        <div className='games-section-back' id='games'>
             <h2 className='games-section-name-osnova'>Ігри</h2>
             <Games/>
             <p className='games-section-text'>Та багато інших</p>
        </div>
    )
}