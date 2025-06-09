import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import DeviceButton from "./DeviceButton";
import BookingModal from "./BookingModal";
import "../styles/Map.css";

const MapSection = forwardRef((props, ref) => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  const [recommendedDuration, setRecommendedDuration] = useState(null);
  const sectionRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const calculatePosition = (device) => {
    const indexMatch = device.id.match(/\d+/);
    const index = indexMatch ? parseInt(indexMatch[0], 10) - 1 : 0;

    switch (device.zone) {
      case "Pro":
        return {
          top: 44 + Math.floor(index / 4) * 98,
          left: 503 + (index % 4) * 94,
        };
      case "VIP":
        return {
          top: 44 + Math.floor(index / 4) * 127,
          left: 20 + (index % 4) * 94,
        };
      case "PS":
        return {
          top: 426 + Math.floor(index / 4) * 50,
          left: 31 + index * 112,
        };
      default:
        return { top: 0, left: 0 };
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await fetch("http://localhost:3001/devices/status");
      const data = await response.json();
      const devicesWithPositions = data.map((device) => ({
        ...device,
        position: calculatePosition(device),
      }));
      setDevices(devicesWithPositions);
    } catch (error) {
      console.error("Помилка завантаження пристроїв:", error);
    }
  };

  useEffect(() => {
    fetchDevices();

    const ws = new WebSocket("ws://localhost:8000");
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (
        message.type === "BOOKING_UPDATED" ||
        message.type === "BOOKING_DELETED"
      ) {
        fetchDevices();
      }
    };
    return () => ws.close();
  }, []);

  // 🔄 Оновлення часу кожні 30 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useImperativeHandle(ref, () => ({
    scrollToSection() {
      if (sectionRef.current) {
        sectionRef.current.scrollIntoView({ behavior: "smooth" });
      }
    },
    openBookingModal(deviceId, recommendedDuration) {
      const device = devices.find((d) => d._id === deviceId);
      if (device) {
        setSelectedDevice(device);
        setRecommendedDuration(recommendedDuration);
        setBookingModalOpen(true);
      } else {
        console.error(`Пристрій із deviceId ${deviceId} не знайдено.`);
      }
    },
  }));

  const handleDeviceClick = (device) => {
    setSelectedDevice(device);
    setRecommendedDuration(null);
    setBookingModalOpen(true);
  };

  return (
    <div className="map-section" ref={sectionRef}>
      <h2 className="map-section-name" id="map">
        Карта
      </h2>
      <div className="map-container">
        <div className="map-info">
          <h2 className="map-text">
            Щоб забронювати ПК чи Консоль, натисніть по відповідній іконці
            пристрою.
          </h2>
          <div className="legend">
            <div className="legend-item">
              <img src={require("../img/greenPC.png")} alt="Вільний ПК" />
              <span>Вільний ПК</span>
            </div>
            <div className="legend-item">
              <img src={require("../img/redPC.png")} alt="Заброньований ПК" />
              <span>Заброньований ПК</span>
            </div>
            <div className="legend-item">
              <img
                src={require("../img/orangePC.png")}
                alt="До броні &lt; 10 хв"
              />
              <span>До броні &lt; 10 хв</span>
            </div>
            <div className="legend-item">
              <img
                src={require("../img/DgreenPC.png")}
                alt="До броні &gt; 10 хв"
              />
              <span>До броні &gt; 10 хв</span>
            </div>
          </div>
        </div>

        <div className="map-wrapper">
          <img
            src={require("../img/mainMap.png")}
            alt="Мапа приміщення"
            className="map-schema"
          />
          {devices.map((device) => (
            <DeviceButton
              key={device.id}
              id={device.id}
              type={device.type}
              bookings={device.bookings}
              position={device.position}
              onClick={() => handleDeviceClick(device)}
              currentTime={currentTime} // ⏱️ Передаємо час
            />
          ))}
        </div>
      </div>

      {isBookingModalOpen && (
        <BookingModal
          isActive={isBookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          selectedDevice={selectedDevice}
          fetchDevices={fetchDevices}
          recommendedDuration={recommendedDuration}
          customStyles={{ width: "500px" }}
        />
      )}
    </div>
  );
});

export default MapSection;
