// netlify/functions/update-menu.js
export async function handler(event, context) {
  // 1. Define standard CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // 2. Handle browser preflight OPTIONS requests immediately
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Successful preflight' })
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    const { pin, generalNotes } = JSON.parse(event.body);
    const ADMIN_PIN = "1234"; // Set your desired admin PIN here

    // 1. Verify PIN
    if (pin !== ADMIN_PIN) {
      return { 
        statusCode: 401, 
        headers, 
        body: JSON.stringify({ error: 'Incorrect PIN' }) 
      };
    }

    const token = process.env.GITHUB_TOKEN;
    const repoPath = "ThreeReasons/config_ThreeReasons_Hub.json";
    const apiUrl = `https://api.github.com/repos/Kearney999/LargsWebDesign/contents/${repoPath}`;

    // 2. Fetch current file from GitHub using the secure server-side token
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

    // 3. Deep-Merge (preserve categories and menu items)
    const mergedConfig = {
      ...existingContentJson,
      MenuSettings: {
        ...(existingContentJson.MenuSettings || {}),
        GeneralNotes: generalNotes
      }
    };

    // 4. Encode back to Base64
    const jsonString = JSON.stringify(mergedConfig, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(jsonString)));

    // 5. Commit changes back to GitHub via API
    const updateRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: 'Update general notices via Netlify secure proxy',
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