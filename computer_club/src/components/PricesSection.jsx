import React from "react";
import "../styles/Table.css";

export default function PricesSection() {
  return (
    <div className="prices-section" id="prices">
      <h2 className="prices-section-name">Ціни</h2>
      <table className="table-price">
        <thead>
          <tr>
            <th className="table-zone zonu">Зони</th>
            <th>1 Година</th>
            <th>3 Години</th>
            <th>5 Годин</th>
            <th>7 Годин</th>
          </tr>
        </thead>
        <tbody>
          {[
            { zone: "Pro Zone", prices: [80, 225, 350, 450] },
            { zone: "VIP Zone", prices: [120, 350, 550, 700] },
            { zone: "PlayStation", prices: [200, 500, null, null] },
          ].map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td className="table-zone">{row.zone}</td>
              {row.prices.map((price, colIndex) => (
                <td key={colIndex} className="price-cell">
                  {price !== null ? `${price} грн` : "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
