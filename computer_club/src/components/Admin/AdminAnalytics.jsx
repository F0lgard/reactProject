import React, { useState } from "react";
import { Tab } from "@headlessui/react";
import StaticAnalytics from "./StaticAnalytics";
import ModelAnalytics from "./ModelAnalytics";
import Pricing from "./Pricing"; // Нова назва для вкладки ціноутворення
import "../../styles/AdminAnalytics.css";

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    {
      name: "Статична аналітика",
      component: <StaticAnalytics loading={loading} setLoading={setLoading} />,
    },
    {
      name: "Прогнози та моделі",
      component: <ModelAnalytics loading={loading} setLoading={setLoading} />,
    },
    {
      name: "Ціноутворення",
      component: <Pricing />,
    },
  ];

  return (
    <div className="admin-analytics-container">
      <Tab.Group
        selectedIndex={selectedTab}
        onChange={(index) => {
          console.log("Selected tab:", index);
          setSelectedTab(index);
        }}
      >
        <div className="admin-header-container">
          <h2 className="admin-header">Аналітична панель адміністратора</h2>

          <Tab.List className="admin-tabs">
            {tabs.map((tab) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  `admin-tab ${selected ? "admin-tab-selected" : ""}`
                }
              >
                {tab.name}
              </Tab>
            ))}
          </Tab.List>
        </div>
        <div className="admin-content">
          <Tab.Panels>
            {tabs.map((tab) => (
              <Tab.Panel key={tab.name}>{tab.component}</Tab.Panel>
            ))}
          </Tab.Panels>
        </div>
      </Tab.Group>
    </div>
  );
};

export default AdminAnalytics;
