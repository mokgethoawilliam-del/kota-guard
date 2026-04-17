import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
// Make sure you have your environment variables set up in your Vite project:
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function MenuList() {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMenu() {
      try {
        setLoading(true);
        // Fetch data from the menu_items table
        const { data, error } = await supabase
          .from('menu_items')
          .select('*')
          .order('name'); 

        if (error) throw error;

        setMenuItems(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMenu();
  }, []);

  if (loading) return <div>Loading menu...</div>;
  if (error) return <div>Error fetching menu: {error}</div>;

  return (
    <div className="menu-container">
      <h2>VulaHub Menu</h2>
      {menuItems.length === 0 ? (
        <p>No menu items found.</p>
      ) : (
        <ul>
          {menuItems.map(item => (
            <li key={item.id}>
              <strong>{item.name}</strong> - R{item.price}
              {/* If you need to map over recipe_json, you can do it here: */}
              {/* {item.recipe_json && <p>Recipe: {JSON.stringify(item.recipe_json)}</p>} */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
