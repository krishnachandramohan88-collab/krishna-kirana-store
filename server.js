const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_KRISHNA_KIRANA_SECRET_2026";
const DB = path.join(__dirname, "data.json");
const UPLOADS = path.join(__dirname, "public", "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });

function load() {
  if (!fs.existsSync(DB)) {
    const initial = {
      shop: {
        name: "Krishna Kirana Store",
        address: "Ward No. 13, near Shiv Mandir Road, Bakuan, bakhurdarchak, Patna, Barkhurdar Chak, Bihar 804452",
        mobile: "9006042992",
        lat: null, lng: null, deliveryRadiusM: 500
      },
      owner: null,
      products: [],
      orders: []
    };
    fs.writeFileSync(DB, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB, "utf8"));
}
function save(db){ fs.writeFileSync(DB, JSON.stringify(db, null, 2)); }
function makeId(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function token(owner){ return jwt.sign({ id: owner.id, mobile: owner.mobile }, JWT_SECRET, { expiresIn:"7d" }); }
function auth(req,res,next){
  try{
    const h=req.headers.authorization||"";
    const t=h.startsWith("Bearer ")?h.slice(7):null;
    if(!t) return res.status(401).json({error:"Login required"});
    req.user=jwt.verify(t,JWT_SECRET); next();
  }catch(e){ res.status(401).json({error:"Invalid or expired login"}); }
}
function haversine(a,b,c,d){
  const R=6371000, rad=x=>x*Math.PI/180;
  const dLat=rad(c-a), dLon=rad(d-b);
  const q=Math.sin(dLat/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}
const storage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,UPLOADS),
  filename:(req,file,cb)=>cb(null,Date.now()+"-"+Math.random().toString(36).slice(2)+path.extname(file.originalname).toLowerCase())
});
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>cb(null,/^image\//.test(file.mimetype))});

app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"public")));

app.get("/api/shop",(req,res)=>{ const d=load(); res.json(d.shop); });

app.post("/api/owner/setup", async (req,res)=>{
  const d=load();
  if(d.owner) return res.status(409).json({error:"Owner account already created"});
  const {mobile,password}=req.body;
  if(mobile!=="9006042992") return res.status(400).json({error:"Use registered shop mobile 9006042992"});
  if(!password || password.length<6) return res.status(400).json({error:"Password must be at least 6 characters"});
  d.owner={id:makeId("own_"),mobile,passwordHash:await bcrypt.hash(password,12)};
  save(d); res.json({ok:true,token:token(d.owner)});
});
app.post("/api/owner/login", async(req,res)=>{
  const d=load(); const {mobile,password}=req.body;
  if(!d.owner || mobile!==d.owner.mobile || !await bcrypt.compare(password||"",d.owner.passwordHash))
    return res.status(401).json({error:"Wrong mobile or password"});
  res.json({token:token(d.owner)});
});
app.put("/api/shop/location",auth,(req,res)=>{
  const d=load(), lat=Number(req.body.lat), lng=Number(req.body.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)) return res.status(400).json({error:"Invalid location"});
  d.shop.lat=lat; d.shop.lng=lng; save(d); res.json(d.shop);
});
app.get("/api/products",(req,res)=>{
  const d=load(); res.json(d.products.filter(p=>p.active!==false));
});
app.get("/api/owner/products",auth,(req,res)=>res.json(load().products));
app.post("/api/products",auth,upload.single("image"),(req,res)=>{
  const d=load();
  const name=(req.body.name||"").trim(), category=(req.body.category||"Other").trim();
  const price=Number(req.body.price), stock=Number(req.body.stock), unit=(req.body.unit||"").trim();
  if(!name||!Number.isFinite(price)||price<0||!Number.isFinite(stock)||stock<0) return res.status(400).json({error:"Valid name, price and stock required"});
  const p={id:makeId("prd_"),name,category,price,stock,unit,image:req.file?"/uploads/"+req.file.filename:"",active:true,createdAt:new Date().toISOString()};
  d.products.unshift(p); save(d); res.json(p);
});
app.put("/api/products/:id",auth,upload.single("image"),(req,res)=>{
  const d=load(), p=d.products.find(x=>x.id===req.params.id);
  if(!p) return res.status(404).json({error:"Product not found"});
  for(const k of ["name","category","unit"]) if(req.body[k]!==undefined) p[k]=String(req.body[k]).trim();
  if(req.body.price!==undefined) p.price=Number(req.body.price);
  if(req.body.stock!==undefined) p.stock=Number(req.body.stock);
  if(req.body.active!==undefined) p.active=String(req.body.active)==="true";
  if(req.file) p.image="/uploads/"+req.file.filename;
  save(d); res.json(p);
});
app.delete("/api/products/:id",auth,(req,res)=>{
  const d=load(), i=d.products.findIndex(x=>x.id===req.params.id);
  if(i<0) return res.status(404).json({error:"Product not found"});
  d.products.splice(i,1); save(d); res.json({ok:true});
});
app.post("/api/delivery/check",(req,res)=>{
  const d=load(), lat=Number(req.body.lat),lng=Number(req.body.lng);
  if(d.shop.lat==null||d.shop.lng==null) return res.status(409).json({error:"Shop location is not set yet"});
  const meters=Math.round(haversine(d.shop.lat,d.shop.lng,lat,lng));
  res.json({meters,eligible:meters<=d.shop.deliveryRadiusM,radius:d.shop.deliveryRadiusM});
});
app.post("/api/orders",(req,res)=>{
  const d=load();
  const {customerName,mobile,address,lat,lng,method,items}=req.body;
  if(!customerName||!mobile||!Array.isArray(items)||!items.length) return res.status(400).json({error:"Customer name, mobile and cart are required"});
  if(!/^\d{10}$/.test(String(mobile))) return res.status(400).json({error:"Enter a valid 10-digit mobile number"});
  let distanceM=null;
  if(method==="delivery"){
    if(d.shop.lat==null||d.shop.lng==null) return res.status(409).json({error:"Shop location is not configured"});
    if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))) return res.status(400).json({error:"Customer location required for delivery"});
    distanceM=Math.round(haversine(d.shop.lat,d.shop.lng,Number(lat),Number(lng)));
    if(distanceM>d.shop.deliveryRadiusM) return res.status(400).json({error:`Delivery is available only within ${d.shop.deliveryRadiusM}m. Please choose pickup.`});
    if(!address) return res.status(400).json({error:"Delivery address required"});
  }
  let total=0; const clean=[];
  for(const it of items){
    const p=d.products.find(x=>x.id===it.productId && x.active!==false);
    const qty=Math.max(1,Math.floor(Number(it.qty)||1));
    if(!p) return res.status(400).json({error:"A product is no longer available"});
    if(p.stock<qty) return res.status(400).json({error:`Only ${p.stock} ${p.name} available`});
    total+=p.price*qty; clean.push({productId:p.id,name:p.name,price:p.price,qty});
  }
  for(const it of clean){ const p=d.products.find(x=>x.id===it.productId); p.stock-=it.qty; }
  const order={id:makeId("ORD-").toUpperCase(),customerName,mobile,address:address||"",lat:lat??null,lng:lng??null,method:method==="delivery"?"delivery":"pickup",distanceM,total,items:clean,status:"Pending",payment:"COD",createdAt:new Date().toISOString()};
  d.orders.unshift(order); save(d); res.json(order);
});
app.get("/api/orders",auth,(req,res)=>res.json(load().orders));
app.put("/api/orders/:id/status",auth,(req,res)=>{
  const allowed=["Pending","Accepted","Ready","Out for delivery","Delivered","Cancelled"];
  if(!allowed.includes(req.body.status)) return res.status(400).json({error:"Invalid status"});
  const d=load(),o=d.orders.find(x=>x.id===req.params.id);
  if(!o) return res.status(404).json({error:"Order not found"});
  o.status=req.body.status; save(d); res.json(o);
});
app.get("/api/order/:id",(req,res)=>{
  const o=load().orders.find(x=>x.id===req.params.id);
  if(!o) return res.status(404).json({error:"Order not found"});
  res.json({id:o.id,status:o.status,total:o.total,method:o.method,createdAt:o.createdAt});
});
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Krishna Kirana Store running at http://localhost:${PORT}`);
});