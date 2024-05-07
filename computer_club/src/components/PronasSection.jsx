import React from 'react'
import '../styles/Pronas.css';
export default function PronasSection() {

    return(
        <div className='pronas-section' id='about'>
    <h2 className='pronas-section-name'>Про нас</h2>
    <div className="content-wrapper">
        <div className="text-wrapper">
            <p className='pronas-section-text'>Комп'ютерний клуб <span className='red-text'>"CyberZone"</span> - це <span className='red-text'>сучасне</span> місце для <span className='red-text'>геймерів</span> та любителів технологій. 
            Ми пропонуємо <span className='red-text'>широкий</span> асортимент послуг для тих, 
            хто цінує <span className='red-text'>якість</span> і <span className='red-text'>комфорт</span> у своїй грі.</p>
            <p className='pronas-section-text'>Ми <span className='red-text'>прагнемо</span> забезпечити нашим клієнтам 
            <span className='red-text'>найкращий</span> ігровий досвід, створюючи для них <span className='red-text'>комфортне</span> та 
            технологічно-збалансоване середовище для <span className='red-text'>розваг</span> та <span className='red-text'>спілкування</span>.</p>
            <div className='logo-wrapper'>
                <a href='https://web.telegram.org/' target='_blank' rel="noreferrer"><img src={require('../img/Telegram.png')} className='logo-pronas' alt='telegram logo' width='60px' height='60px'/></a>
                <img src={require('../img/Steam.png')} className='logo-pronas' alt='steam logo' width='55px' height='55px'/>
                <img src={require('../img/Instagram.png')} className='logo-pronas' alt='instagram logo' width='70px' height='70px'/>
            </div>
            <p>Номер телефону: <a href="tel:+380123456789">+380123456789</a></p>
            <p>Email: <a href="mailto:example@example.com">example@example.com</a></p>
        </div>
        <img src={require('../img/pronas.png')} className='pronas-img' alt='pro nas img' width='387px' height='480px'/>
        {/* <iframe className='google-map' src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d101627.05808999788!2d-115.80400715000002!3d37.25137145!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80b81baaba3e8c81%3A0x970427e38e6237ae!2z0JfQvtC90LAgNTEsINCd0LXQstCw0LTQsCwg0KHQv9C-0LvRg9GH0LXQvdGWINCo0YLQsNGC0Lgg0JDQvNC10YDQuNC60Lg!5e0!3m2!1suk!2sfr!4v1714986350915!5m2!1suk!2sfr" width="600" height="450" style={{border:"0"}} allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title='Google Map'></iframe> */}

    </div>
</div>

    )
}