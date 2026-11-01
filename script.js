/*
 * KasToko frontend.
 * Isi API_URL dengan URL Web App Google Apps Script yang berakhir /exec.
 * JSONP dipakai agar frontend Live Server bisa berkomunikasi dengan Apps Script.
 */
const API_URL = "https://script.google.com/macros/s/AKfycbxd7CcdyYvc4Po8W2B8o5CXFGIGQp4P8NRZXJpL-2kSifYk-c_cw99J20PqrjLA43Y/exec";
const state = { transactions: [], chart: null };
const $ = id => document.getElementById(id);
const rupiah = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const dateLabel = value => { if(!value)return "-"; const d=new Date(`${String(value).slice(0,10)}T00:00:00`); return Number.isNaN(d.getTime())?value:d.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}); };
const typeLabel = type => ({kasir:"Kasir",pemasukan:"Pemasukan",pengeluaran:"Pengeluaran"}[type]||type||"-");
function toast(message,isError=false){const el=$("toast");el.textContent=message;el.classList.toggle("error",isError);el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3600);}
function loading(show,message="Memproses..."){$("loadingText").textContent=message;$("loadingOverlay").classList.toggle("hidden",!show);}
function setConnection(connected){document.querySelector(".status-dot").classList.toggle("connected",connected);$("connectionText").textContent=connected?"Terhubung":"Belum terhubung";}
function api(action,payload={}){return new Promise((resolve,reject)=>{if(!API_URL||API_URL.includes("PASTE_URL_")){reject(new Error("URL Apps Script belum diisi. Buka script.js dan isi API_URL."));return;}const callback="kasTokoCb_"+Date.now()+"_"+Math.floor(Math.random()*100000);const script=document.createElement("script");const timer=setTimeout(()=>finish(new Error("Waktu koneksi habis. Periksa URL deployment dan izin akses Apps Script.")),20000);function finish(err,data){clearTimeout(timer);delete window[callback];script.remove();err?reject(err):resolve(data);}window[callback]=response=>{if(!response||response.ok!==true)return finish(new Error(response?.error||"Respons backend tidak valid."));finish(null,response.data);};script.onerror=()=>finish(new Error("Tidak dapat menghubungi Apps Script. Periksa URL Web App dan akses deployment."));const params=new URLSearchParams({action,callback,payload:JSON.stringify(payload)});script.src=`${API_URL}${API_URL.includes("?")?"&":"?"}${params.toString()}`;document.body.appendChild(script);});}
function showView(view){document.querySelectorAll(".view").forEach(el=>el.classList.remove("active"));$(`${view}View`).classList.add("active");document.querySelectorAll(".nav-link").forEach(el=>el.classList.toggle("active",el.dataset.view===view));$("pageTitle").textContent=view==="dashboard"?"Dashboard":"Input Transaksi";$("sidebar").classList.remove("open");}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function transactionRow(t){const out=t.type==="pengeluaran";return `<tr><td>${escapeHtml(dateLabel(t.date))}</td><td><span class="type-pill ${escapeHtml(t.type)}">${escapeHtml(typeLabel(t.type))}</span></td><td>${escapeHtml(t.description||"-")}${t.notes?`<div style="color:#91a09d;font-size:10px;margin-top:4px">${escapeHtml(t.notes)}</div>`:""}</td><td>${escapeHtml(t.method||"-")}</td><td class="align-right ${out?"amount-out":"amount-in"}">${out?"− ":"+ "}${escapeHtml(rupiah(t.amount))}</td></tr>`;}
function renderRows(target,rows){$(target).innerHTML=rows.length?rows.map(transactionRow).join(""):'<tr><td colspan="5" class="empty-cell">Belum ada transaksi.</td></tr>';}
function renderChart(monthly){const empty=$("chartEmpty");if(!monthly||!monthly.length){empty.classList.remove("hidden");return;}if(typeof Chart==="undefined"){empty.textContent="Grafik sedang dimuat. Pastikan koneksi internet aktif.";empty.classList.remove("hidden");return;}empty.classList.add("hidden");if(state.chart)state.chart.destroy();state.chart=new Chart($("cashflowChart"),{type:"bar",data:{labels:monthly.map(m=>m.label),datasets:[{label:"Pemasukan",data:monthly.map(m=>m.income),backgroundColor:"#14b8a6",borderRadius:5,maxBarThickness:22},{label:"Pengeluaran",data:monthly.map(m=>m.expense),backgroundColor:"#f87171",borderRadius:5,maxBarThickness:22},{label:"Laba",data:monthly.map(m=>m.profit??(m.income-m.expense)),type:"line",borderColor:"#6366f1",backgroundColor:"#6366f1",borderWidth:3,tension:.3,pointRadius:3,pointBackgroundColor:"#6366f1"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:7,font:{size:10}}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${rupiah(c.raw)}`}}},scales:{x:{grid:{display:false},ticks:{font:{size:9},maxRotation:0}},y:{grid:{color:"#edf2f0"},ticks:{font:{size:9},callback:v=>new Intl.NumberFormat("id-ID",{notation:"compact",maximumFractionDigits:1}).format(v)}}}}});}
function monthKeyNow(){return localDate().slice(0,7);}
function monthLabel(key){if(!key)return "Semua periode";const d=new Date(`${key}-01T00:00:00`);return d.toLocaleDateString("id-ID",{month:"long",year:"numeric"});}
function setupMonthSelector(monthly){
  const select=$("dashboardMonth");
  const current=select.value || monthKeyNow();
  const keys=new Set((monthly||[]).map(m=>m.key).filter(Boolean));
  state.transactions.forEach(t=>{if(t.date)keys.add(String(t.date).slice(0,7));});
  keys.add(monthKeyNow());
  const sorted=[...keys].sort((a,b)=>b.localeCompare(a));
  select.innerHTML=sorted.map(key=>`<option value="${escapeHtml(key)}">${escapeHtml(monthLabel(key))}</option>`).join("");
  select.value=keys.has(current)?current:(sorted[0]||monthKeyNow());
}
function updateMonthlyCards(){
  const selected=$("dashboardMonth").value;
  const rows=state.transactions.filter(t=>String(t.date||"").slice(0,7)===selected);
  let income=0,expense=0;
  rows.forEach(t=>{if(t.type==="pengeluaran")expense+=Number(t.amount)||0;else income+=Number(t.amount)||0;});
  $("balanceValue").textContent=rupiah(income-expense);
  $("incomeValue").textContent=rupiah(income);
  $("expenseValue").textContent=rupiah(expense);
  $("countValue").textContent=new Intl.NumberFormat("id-ID").format(rows.length);
  $("dashboardPeriodLabel").textContent=`Ringkasan untuk ${monthLabel(selected)}.`;
}
async function loadData(showMessage=false){
  loading(true,"Mengambil data dari Spreadsheet...");
  try{
    const data=await api("dashboard");
    state.transactions=data.transactions||[];
    setupMonthSelector(data.monthly||[]);
    updateMonthlyCards();
    renderRows("recentRows",state.transactions.slice(0,8));
    renderChart(data.monthly||[]);
    setConnection(true);
    if(showMessage)toast("Data berhasil diperbarui.");
  }catch(err){
    setConnection(false);
    $("recentRows").innerHTML=`<tr><td colspan="5" class="empty-cell">${escapeHtml(err.message)}</td></tr>`;
    $("chartEmpty").textContent=err.message;$("chartEmpty").classList.remove("hidden");
    if(showMessage)toast(err.message,true);
  }finally{loading(false);}
}
async function saveForm(event){event.preventDefault();const form=event.currentTarget;const values=Object.fromEntries(new FormData(form).entries());const payload={type:form.dataset.type,date:values.date,description:String(values.description||"").trim(),amount:Number(values.amount),method:"Tunai",notes:""};if(!payload.date||!payload.description||!Number.isFinite(payload.amount)||payload.amount<=0){toast("Tanggal, keterangan, dan jumlah yang valid wajib diisi.",true);return;}const button=form.querySelector('button[type="submit"]');button.disabled=true;loading(true,"Menyimpan transaksi...");try{await api("addTransaction",payload);form.reset();form.querySelector('[name="date"]').value=localDate();toast(`${typeLabel(payload.type)} berhasil disimpan.`);await loadData(false);showView("dashboard");}catch(err){toast(err.message,true);}finally{loading(false);button.disabled=false;}}
function init(){const today=localDate();$("todayLabel").textContent=new Date().toLocaleDateString("id-ID",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});document.querySelectorAll(".simple-form").forEach(form=>{form.querySelector('[name="date"]').value=today;form.addEventListener("submit",saveForm);});document.querySelectorAll("[data-view]").forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.view)));$("topAddBtn").addEventListener("click",()=>showView("transactions"));$("refreshBtn").addEventListener("click",()=>loadData(true));$("dashboardMonth").addEventListener("change",updateMonthlyCards);$("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));const chartScript=document.createElement("script");chartScript.src="https://cdn.jsdelivr.net/npm/chart.js";chartScript.onload=()=>{if(state.transactions.length)loadData(false);};chartScript.onerror=()=>{$("chartEmpty").textContent="Grafik tidak dapat dimuat. Periksa koneksi internet.";};document.head.appendChild(chartScript);loadData();}
document.addEventListener("DOMContentLoaded",init);
