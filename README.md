# Krishna Kirana Store — Working V1

## Features
- Real Express backend
- Persistent JSON database
- Owner first-time setup + login (bcrypt password hash + JWT)
- Owner adds products with image, price, stock, unit, category
- Product edit/delete
- Customer product search/category browsing/cart
- COD checkout
- Browser GPS location
- Exact 500m delivery eligibility using Haversine distance
- Pickup outside delivery radius
- Order creation, stock deduction, order tracking
- Owner order dashboard and status updates
- WhatsApp/tel contact
- Responsive frontend
- Leaflet + OpenStreetMap display

## Run on Windows PowerShell
1. Install Node.js LTS.
2. Open this project folder in PowerShell.
3. Run:
   npm install
   npm start
4. Open http://localhost:5000

## First owner setup
- Open Owner.
- Mobile: 9006042992
- Choose a password of at least 6 characters.
- Click First-time Setup.
- While physically at the shop, click "Use My Current Location".
- Add products.

## Important production notes
This is a working V1, but public internet deployment needs HTTPS, a hosted persistent database/storage, backups, secure environment variables, and preferably OTP/admin recovery. Browser geolocation normally requires HTTPS on deployed sites. The included JSON database is suitable for a small pilot, not a large multi-server deployment. Public OpenStreetMap tiles should not be treated as guaranteed high-volume commercial tile hosting.
