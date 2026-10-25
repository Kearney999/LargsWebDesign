// netlify/functions/update-menu.js
export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'Successful preflight' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { pin, generalNotes, soupDescription } = JSON.parse(event.body);
    const ADMIN_PIN = "1234";

    if (pin !== ADMIN_PIN) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Incorrect PIN' }) };
    }

    const token = process.env.GITHUB_TOKEN;
    const repoPath = "ThreeReasons/config_ThreeReasons_Hub.json";
    const apiUrl = `https://api.github.com/repos/Kearney999/LargsWebDesign/contents/${repoPath}`;

    const getRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!getRes.ok) throw new Error('Failed to fetch config from GitHub');
    
    const fileData = await getRes.json();
    const existingContentJson = JSON.parse(
      decodeURIComponent(escape(atob(fileData.content)))
    );

    // 1. Update General Notes in MenuSettings
    const updatedMenuSettings = {
      ...(existingContentJson.MenuSettings || {}),
      GeneralNotes: generalNotes
    };

    // 2. Update Customer Hub Soup Widget description
    const updatedCustomerHub = {
    ...existingContentJson.CustomerHub,
    categories: (existingContentJson.CustomerHub?.categories || []).map(cat => ({
        ...cat,
        items: (cat.items || []).map(item => {
        const titleLower = (item.title || '').toLowerCase();
        // Matches "soup of the day" regardless of apostrophe style or exact icon unicode
        if (titleLower.includes('soup of the day')) {
            return { ...item, description: soupDescription };
        }
        return item;
        })
    }))
    };

    // 3. Update Starters Menu Item description
    const updatedMenuItems = existingContentJson.MenuItems.map(item => {
      if (item.id === "traditional-homemade-soup-of-the-day") {
        return { ...item, description: soupDescription };
      }
      return item;
    });

    const mergedConfig = {
      ...existingContentJson,
      MenuSettings: updatedMenuSettings,
      CustomerHub: updatedCustomerHub,
      MenuItems: updatedMenuItems
    };

    const jsonString = JSON.stringify(mergedConfig, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(jsonString)));

    const updateRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: 'Update general notes and daily soup via Netlify secure proxy',
        content: encodedContent,
        sha: fileData.sha
      })
    });

    if (!updateRes.ok) throw new Error('Failed to commit update to GitHub');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};