import React from 'react';
import '../styles/Table.css';

const PriceTable = () => {
  return (
    <table>
      <thead>
        <tr>
          <th className='table-zone zonu'>Зони</th>
          <th>1 Година</th>
          <th>3 Години</th>
          <th>5 Годин</th>
          <th>7 Годин</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className='table-zone'>Pro Zone</td>
          <td>80₴</td>
          <td>225₴</td>
          <td>350₴</td>
          <td>450₴</td>
        </tr>
        <tr>
          <td className='table-zone'>VIP Zone</td>
          <td>120₴</td>
          <td>350₴</td>
          <td>550₴</td>
          <td>700₴</td>
        </tr>
        <tr>
          <td className='table-zone'>PlayStation</td>
          <td>200₴</td>
          <td>500₴</td>
          <td>------</td>
          <td>------</td>
        </tr>
      </tbody>
    </table>
  );
};

export default PriceTable;
