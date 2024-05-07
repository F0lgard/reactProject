import React from 'react';
import PriceTable from './PriceTable'
import Button from './Button';

export default function PricesSection() {
    return(
        <div className='prices-section' id='prices'>
            <h2 className='prices-section-name'>Ціни</h2>
            <PriceTable/>
            <Button className="button-zabronuvatu">Забронювати</Button>
        </div>
    )
}