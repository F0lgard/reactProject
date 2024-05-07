// import React, { useState, useEffect } from 'react';
import SwiperCore from 'swiper';
import {Pagination} from 'swiper/modules';

import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css/bundle';

import data from '../data.json'
SwiperCore.use([Pagination]);


const Slider = () => {

  return (
      <Swiper 
      style={{
        "--swiper-pagination-color": "#FF0000",
        "--swiper-pagination-bullet-inactive-color": "#ffffff",
        "--swiper-pagination-bullet-inactive-opacity": "1",
        "--swiper-pagination-bullet-size": "8px",
        "--swiper-pagination-bullet-width": "60px",
        "--swiper-pagination-bullet-height": "7px",
        "--swiper-pagination-bullet-border-radius": "0%",
        "--swiper-pagination-bullet-horizontal-gap": "17px"
      }}
        slidesPerView={1.5}
        spaceBetween={10}
        pagination={{ clickable: true }}
      >
        {data.map((slide, index) => (
          <SwiperSlide key={index}>
            <div className='slider-div'>
              <img src={require(`../img/${slide.image}`)} alt="Zone Section" className='slider-zone-img'/>
              <h2 className='slider-zone-name'>{slide.zoneName}</h2>
              <h3 className='slider-punkt'>ПК</h3>
              <div className='slider-div-ul'><ul className='slider-ul'>
                {slide.pc.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <strong>{item.name}:</strong>
                  </li>
                ))}
              </ul>
              <ul className='slider-ul'>
                {slide.pc.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <span>{item.value}:</span>
                  </li>
                ))}
              </ul></div>
              <h3 className='slider-punkt'>Переферія</h3>
              <div className='slider-div-ul'><ul className='slider-ul'>
                {slide.peripherals.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <strong>{item.name}:</strong>
                  </li>
                ))}
              </ul>
              <ul className='slider-ul'>
                {slide.peripherals.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <span>{item.value}:</span>
                  </li>
                ))}
              </ul></div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
  );
};

export default Slider;
