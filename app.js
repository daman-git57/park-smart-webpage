// ParkSmart frontend-only demo. Data is stored in this browser using localStorage.
const STORAGE_KEY = 'parksmart_frontend_v1';
const floors = [{id:'B1',name:'Basement'},{id:'G',name:'Ground'},{id:'F1',name:'First'},{id:'F2',name:'Second'},{id:'F3',name:'Third'}];
const types = ['Two-wheeler','Car','SUV','Electric vehicle'];
const defaultRates = {'Two-wheeler':{first:20,extra:10},Car:{first:40,extra:20},SUV:{first:50,extra:25},'Electric vehicle':{first:30,extra:15}};
let state, activeFloor='B1', selectedTicket=null, charts={};
const $ = id => document.getElementById(id);
const now = () => new Date().toISOString();
const money = n => '₹' + Number(n||0).toLocaleString('en-IN');
const dateTime = value => value ? new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function makeInitialState(){
 const slots=[]; floors.forEach(f=>{for(let i=1;i<=30;i++){const ev=(f.id==='G'&&i<=4)||(f.id==='F1'&&i<=4);slots.push({id:`${f.id}-${String(i).padStart(2,'0')}`,floor:f.id,status:'Available',vehicleNumber:'',vehicleType:'',ticketId:'',isEV:ev,updatedAt:now()});}});
 return {slots,tickets:[],payments:[],notifications:[],rates:structuredClone(defaultRates),activity:[]};
}
let saveQueue = Promise.resolve();

async function load(){
    const { data, error } = await window.supabaseClient
        .from('app_state')
        .select('data')
        .eq('id', 'main')
        .maybeSingle();

    if (error) throw error;

    if (data && data.data) {
        state = data.data;
    } else {
        const raw = localStorage.getItem(STORAGE_KEY);
        state = raw ? JSON.parse(raw) : makeInitialState();
        if (!state.slots || state.slots.length !== 150) state = makeInitialState();
        await save();
    }
}

function save(){
    const snapshot = JSON.parse(JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));

    if (!window.supabaseClient) return Promise.resolve();

    saveQueue = saveQueue.then(async () => {
        const { error } = await window.supabaseClient
            .from('app_state')
            .upsert({
                id: 'main',
                data: snapshot,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (error) {
            console.error('Supabase save failed:', error);
            toast('Could not save to Supabase. Check connection and RLS policies.');
        }
    }).catch(error => {
        console.error('Supabase save queue failed:', error);
        toast('Supabase save failed. Check the browser Console.');
    });

    return saveQueue;
}
function log(message){state.activity.unshift({message,time:now()});state.activity=state.activity.slice(0,50);}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600);}
function notify(title,message,type='info'){state.notifications.unshift({id:'N'+Date.now(),title,message,type,time:now(),read:false});save();renderNoticeCount();}
function activeTickets(){return state.tickets.filter(t=>t.status==='Active');}
function occupiedCount(){return state.slots.filter(s=>s.status==='Occupied').length;}
function durationHours(t){return Math.max(1,Math.ceil(((t.exitTime?new Date(t.exitTime):new Date())-new Date(t.entryTime))/3600000));}
function feeFor(t){const rate=state.rates[t.vehicleType]||defaultRates.Car;const hrs=durationHours(t);return rate.first+Math.max(0,hrs-1)*rate.extra;}
function renderStats(){const total=state.slots.length,occupied=occupiedCount(),available=state.slots.filter(s=>s.status==='Available').length,reserved=state.slots.filter(s=>s.status==='Reserved').length,today=new Date().toDateString();const entries=state.tickets.filter(t=>new Date(t.entryTime).toDateString()===today).length,exits=state.tickets.filter(t=>t.exitTime&&new Date(t.exitTime).toDateString()===today).length,revenue=state.payments.filter(p=>new Date(p.time).toDateString()===today).reduce((a,p)=>a+p.amount,0);const cards=[['Total capacity',total,'▤'],['Available spaces',available,'✓'],['Occupied spaces',occupied,'▣'],['Reserved spaces',reserved,'⚑'],['Vehicles parked',activeTickets().length,'🚗'],["Today's entries",entries,'↘'],["Today's exits",exits,'↗'],["Today's revenue",money(revenue),'₹']];$('statsGrid').innerHTML=cards.map(([a,b,c])=>`<div class="stat-card"><div class="stat-top"><span>${a}</span><span class="stat-icon">${c}</span></div><div class="stat-value">${b}</div><div class="stat-foot">${a==='Total capacity'?'Across 5 floors':a==='Occupied spaces'?`${Math.round(occupied/total*100)}% occupancy`: 'Local demo data'}</div></div>`).join('');}
function chart(id,type,labels,datasets,extra={}){if(!window.Chart)return;const el=$(id);if(!el)return;if(charts[id])charts[id].destroy();charts[id]=new Chart(el,{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==='doughnut'||type==='pie'}} ,scales:type==='doughnut'||type==='pie'?{}:{y:{beginAtZero:true}},...extra}});}
function renderCharts(){const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d;});const labels=days.map(d=>d.toLocaleDateString('en-IN',{day:'numeric',month:'short'}));const entries=days.map(d=>state.tickets.filter(t=>new Date(t.entryTime).toDateString()===d.toDateString()).length);const exits=days.map(d=>state.tickets.filter(t=>t.exitTime&&new Date(t.exitTime).toDateString()===d.toDateString()).length);chart('trafficChart','bar',labels,[{label:'Entries',data:entries,backgroundColor:'#3268e8'},{label:'Exits',data:exits,backgroundColor:'#18a66a'}]);chart('floorChart','bar',floors.map(f=>f.name),[{label:'Occupied',data:floors.map(f=>state.slots.filter(s=>s.floor===f.id&&s.status==='Occupied').length),backgroundColor:'#e6535b'}]);chart('revenueChart','line',labels,[{label:'Revenue (₹)',data:days.map(d=>state.payments.filter(p=>new Date(p.time).toDateString()===d.toDateString()).reduce((a,p)=>a+p.amount,0)),borderColor:'#3268e8',backgroundColor:'#3268e822',fill:true,tension:.3}]);chart('typeChart','doughnut',types,[{label:'Vehicles',data:types.map(t=>activeTickets().filter(x=>x.vehicleType===t).length),backgroundColor:['#3268e8','#18a66a','#e6aa32','#8b6bd6']}]);}
function renderRecent(){const rows=[...state.tickets].sort((a,b)=>new Date(b.entryTime)-new Date(a.entryTime)).slice(0,7);$('recentTable').innerHTML=rows.map(t=>`<tr><td>${escapeHTML(t.ticketId)}</td><td>${escapeHTML(t.vehicleNumber)}</td><td>${escapeHTML(t.vehicleType)}</td><td>${escapeHTML(t.slotId)}</td><td>${dateTime(t.entryTime)}</td><td><span class="status-pill status-${t.status.toLowerCase()}">${t.status}</span></td></tr>`).join('')||'<tr><td colspan="6">No vehicle activity yet. Add a vehicle to get started.</td></tr>';}
function renderDashboard(){renderStats();renderRecent();renderCharts();}
function renderFloorTabs(){$('floorTabs').innerHTML=floors.map(f=>`<button class="tab ${f.id===activeFloor?'active':''}" data-floor="${f.id}">${f.name}</button>`).join('');}
function renderParking(){const status=$('statusFilter').value,type=$('typeFilter').value;const list=state.slots.filter(s=>s.floor===activeFloor&&(status==='all'||s.status===status)&&(type==='all'||s.vehicleType===type));$('slotGrid').innerHTML=list.map(s=>`<button class="slot ${s.status.toLowerCase()}" data-slot="${s.id}">${s.id}<small>${s.isEV?'⚡ EV · ':''}${s.status}</small></button>`).join('')||'<p>No slots match these filters.</p>';}
function showSlot(id){const s=state.slots.find(x=>x.id===id);if(!s)return;$('slotDetails').innerHTML=`<div class="details-grid"><div><small>Slot ID</small><b>${s.id}</b></div><div><small>Floor</small><b>${floors.find(f=>f.id===s.floor).name}</b></div><div><small>Status</small><b>${s.status}</b></div><div><small>Vehicle number</small><b>${escapeHTML(s.vehicleNumber||'—')}</b></div><div><small>Vehicle type</small><b>${escapeHTML(s.vehicleType||'—')}</b></div><div><small>Ticket ID</small><b>${escapeHTML(s.ticketId||'—')}</b></div><div><small>EV charger</small><b>${s.isEV?'Yes':'No'}</b></div><div><small>Updated</small><b>${dateTime(s.updatedAt)}</b></div></div>`;}
function setSlotStatus(slot,status){slot.status=status;slot.updatedAt=now();if(status!=='Occupied'){slot.vehicleNumber='';slot.vehicleType='';slot.ticketId='';}}
function chooseSlot(type,requirement){let candidates=state.slots.filter(s=>s.status==='Available');if(type==='Electric vehicle'||requirement==='ev')candidates=candidates.filter(s=>s.isEV);if(requirement==='accessible')candidates=candidates.filter(s=>s.id.endsWith('01')||s.id.endsWith('02'));if(!candidates.length&&type!=='Electric vehicle'&&requirement!=='ev')candidates=state.slots.filter(s=>s.status==='Available');const counts=Object.fromEntries(floors.map(f=>[f.id,state.slots.filter(s=>s.floor===f.id&&s.status==='Occupied').length]));candidates.sort((a,b)=>counts[a.floor]-counts[b.floor]||a.id.localeCompare(b.id));return candidates[0];}
function showTicket(t){selectedTicket=t;$('ticketContent').innerHTML=`<div class="ticket-head"><div class="brand-icon" style="margin:auto">P</div><h2>ParkSmart</h2><p>INTELLIGENT PARKING MANAGEMENT</p><div class="ticket-code">${t.ticketId}</div></div><div class="ticket-data">${[['Vehicle number',t.vehicleNumber],['Vehicle type',t.vehicleType],['Entry time',dateTime(t.entryTime)],['Floor',floors.find(f=>f.id===t.floor)?.name||t.floor],['Parking slot',t.slotId],['Entry gate',t.entryGate],['Driver',t.driverName||'—'],['Status',t.status]].map(([a,b])=>`<div><small>${a}</small><b>${escapeHTML(b)}</b></div>`).join('')}</div><div class="qr-wrap"><div id="ticketQR"></div></div>`;$('ticketModal').classList.remove('hidden');if(window.QRCode)new QRCode($('ticketQR'),{text:JSON.stringify({ticketId:t.ticketId,vehicleNumber:t.vehicleNumber,slotId:t.slotId}),width:112,height:112});}
function createEntry(data){const reg=data.vehicleNumber.toUpperCase().replace(/\s+/g,' ').trim();if(state.tickets.some(t=>t.status==='Active'&&t.vehicleNumber===reg))throw Error('This vehicle already has an active parking ticket.');const slot=chooseSlot(data.vehicleType,data.requirement);if(!slot)throw Error('No compatible parking slot is available.');const ticket={ticketId:'PS-'+Date.now().toString(36).toUpperCase(),vehicleNumber:reg,vehicleType:data.vehicleType,driverName:data.driverName,contact:data.contact,entryGate:data.entryGate,entryTime:now(),floor:slot.floor,slotId:slot.id,status:'Active',requirement:data.requirement};setSlotStatus(slot,'Occupied');slot.vehicleNumber=reg;slot.vehicleType=data.vehicleType;slot.ticketId=ticket.ticketId;state.tickets.unshift(ticket);log(`Vehicle ${reg} entered and was assigned ${slot.id}`);if(state.slots.filter(s=>s.floor===slot.floor&&s.status==='Occupied').length>=27)notify('Floor almost full',`${slot.floor} has reached 90% occupancy.`,'warning');if(!state.slots.some(s=>s.isEV&&s.status==='Available'))notify('No EV charger available','All EV charging spaces are currently occupied.','warning');save();return ticket;}
function renderHistory(){const q=($('historySearch').value||'').toUpperCase(),st=$('historyStatus').value,ty=$('historyType').value;const rows=state.tickets.filter(t=>(!q||`${t.ticketId} ${t.vehicleNumber}`.toUpperCase().includes(q))&&(st==='all'||t.status===st)&&(ty==='all'||t.vehicleType===ty));$('historyTable').innerHTML=rows.map(t=>`<tr><td>${t.ticketId}</td><td>${escapeHTML(t.vehicleNumber)}</td><td>${t.vehicleType}</td><td>${dateTime(t.entryTime)}</td><td>${dateTime(t.exitTime)}</td><td>${t.floor} / ${t.slotId}</td><td>${t.exitTime?durationHours(t)+' hr':'—'}</td><td>${t.amount?money(t.amount):'—'}</td><td>${t.paymentMethod||'—'}</td><td><span class="status-pill status-${t.status.toLowerCase()}">${t.status}</span></td></tr>`).join('')||'<tr><td colspan="10">No matching parking records.</td></tr>';}
function findExit(){const q=$('exitSearch').value.trim().toUpperCase();const t=state.tickets.find(x=>x.status==='Active'&&(x.ticketId.toUpperCase()===q||x.vehicleNumber.toUpperCase()===q));if(!t){$('exitResult').innerHTML='<p class="message">No active vehicle found. Check the ticket ID or registration number.</p>';return;}const hours=durationHours(t),amount=feeFor(t);$('exitResult').innerHTML=`<div class="exit-summary"><h3>Vehicle found</h3><div class="details-grid"><div><small>Vehicle</small><b>${t.vehicleNumber}</b></div><div><small>Type</small><b>${t.vehicleType}</b></div><div><small>Entry</small><b>${dateTime(t.entryTime)}</b></div><div><small>Slot</small><b>${t.floor} / ${t.slotId}</b></div><div><small>Duration</small><b>${hours} hour(s)</b></div><div><small>Ticket</small><b>${t.ticketId}</b></div></div><hr><div class="payment-row"><div><small>Parking fee</small><div class="bill-total">${money(amount)}</div></div><label>Payment method<select id="paymentMethod"><option>Cash</option><option>UPI</option><option>Card</option></select></label><button class="btn primary" id="confirmPayment">Confirm payment & exit</button></div></div>`;$('confirmPayment').onclick=()=>completeExit(t.ticketId);}
function completeExit(id){const t=state.tickets.find(x=>x.ticketId===id&&x.status==='Active');if(!t)return toast('This ticket is already completed.');const amount=feeFor(t),method=$('paymentMethod').value;t.exitTime=now();t.status='Completed';t.durationHours=durationHours(t);t.amount=amount;t.paymentMethod=method;state.payments.unshift({ticketId:id,amount,method,time:t.exitTime,vehicleNumber:t.vehicleNumber});const slot=state.slots.find(s=>s.id===t.slotId);if(slot)setSlotStatus(slot,'Available');log(`Vehicle ${t.vehicleNumber} exited. Payment ${money(amount)} via ${method}.`);save();$('exitResult').innerHTML=`<div class="message success">Payment of ${money(amount)} received. Slot ${t.slotId} is now available.</div><button class="btn light" id="receiptBtn">Download receipt PDF</button>`;$('receiptBtn').onclick=()=>downloadPDF('ParkSmart Parking Receipt',[`Ticket: ${t.ticketId}`,`Vehicle: ${t.vehicleNumber}`,`Type: ${t.vehicleType}`,`Entry: ${dateTime(t.entryTime)}`,`Exit: ${dateTime(t.exitTime)}`,`Slot: ${t.slotId}`,`Duration: ${t.durationHours} hour(s)`,`Amount: ${money(amount)}`,`Payment: ${method}`]);refreshAll();toast('Vehicle exit completed successfully.');}
function renderEV(){const ev=state.slots.filter(s=>s.isEV),busy=ev.filter(s=>s.status==='Occupied'),free=ev.filter(s=>s.status==='Available');$('evStats').innerHTML=[['Total EV slots',ev.length],['Available chargers',free.length],['Occupied chargers',busy.length],['Charging sessions',busy.length]].map(([a,b])=>`<div class="stat-card"><div class="stat-top">${a}</div><div class="stat-value">${b}</div></div>`).join('');$('evTable').innerHTML=ev.map(s=>`<tr><td>${s.id}</td><td><span class="status-pill status-${s.status.toLowerCase()}">${s.status}</span></td><td>${s.vehicleNumber||'—'}</td><td>${s.status==='Occupied'?dateTime(s.updatedAt):'—'}</td><td>${s.status==='Occupied'?'Active':'—'}</td></tr>`).join('');}
function renderNotices(){renderNoticeCount();$('notificationList').innerHTML=state.notifications.map(n=>`<div class="notice"><div class="notice-icon">${n.type==='warning'?'⚠':'♢'}</div><div><b>${escapeHTML(n.title)}</b><p>${escapeHTML(n.message)}</p><small>${dateTime(n.time)} · ${n.read?'Read':'Unread'}</small></div></div>`).join('')||'<div class="card">No notifications yet. System alerts will appear here.</div>';}
function renderNoticeCount(){$('noticeCount').textContent=state.notifications.filter(n=>!n.read).length;}
function renderSettings(){$('rateInputs').innerHTML=types.map(t=>`<div class="rate-row"><span>${t}</span><input type="number" min="0" id="rate-${types.indexOf(t)}-first" value="${state.rates[t].first}" aria-label="${t} first hour"><input type="number" min="0" id="rate-${types.indexOf(t)}-extra" value="${state.rates[t].extra}" aria-label="${t} additional hour"></div>`).join('');$('manageSlot').innerHTML=state.slots.map(s=>`<option value="${s.id}">${s.id} (${s.status})</option>`).join('');}
function renderReports(){const completed=state.tickets.filter(t=>t.status==='Completed'),revenue=state.payments.reduce((a,p)=>a+p.amount,0),avg=completed.length?Math.round(completed.reduce((a,t)=>a+(t.durationHours||1),0)/completed.length*10)/10:0;$('reportStats').innerHTML=[['Total revenue',money(revenue)],['Total entries',state.tickets.length],['Completed exits',completed.length],['Average duration',avg+' hrs']].map(([a,b])=>`<div class="stat-card"><div class="stat-top">${a}</div><div class="stat-value">${b}</div></div>`).join('');const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d;});chart('reportRevenue','bar',days.map(d=>d.toLocaleDateString('en-IN',{day:'numeric',month:'short'})),[{label:'Revenue',data:days.map(d=>state.payments.filter(p=>new Date(p.time).toDateString()===d.toDateString()).reduce((a,p)=>a+p.amount,0)),backgroundColor:'#3268e8'}]);chart('reportVehicles','doughnut',types,[{label:'Entries',data:types.map(t=>state.tickets.filter(x=>x.vehicleType===t).length),backgroundColor:['#3268e8','#18a66a','#e6aa32','#8b6bd6']}]);const hours=Array(24).fill(0);state.tickets.forEach(t=>hours[new Date(t.entryTime).getHours()]++);const peak=Math.max(...hours);$('peakHours').textContent=peak?`Busiest recorded entry hour: ${String(hours.indexOf(peak)).padStart(2,'0')}:00 – ${String((hours.indexOf(peak)+1)%24).padStart(2,'0')}:00 (${peak} entries).`:'No entry data available yet.';}
function refreshAll(){renderDashboard();renderParking();renderHistory();renderEV();renderNotices();renderSettings();}
function go(page){const pages=['dashboard','parking','entry','exit','history','ev','reports','notifications','settings'];pages.forEach(p=>$(p+'Page').classList.toggle('active',p===page));document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const titles={dashboard:['Dashboard','Overview of your parking facility'],parking:['Live Parking','Monitor all parking spaces'],entry:['Vehicle Entry','Register a new vehicle'],exit:['Vehicle Exit','Calculate charges and release slots'],history:['Parking History','View all parking records'],ev:['EV Charging','Monitor EV charging spaces'],reports:['Reports & Analytics','Parking facility performance'],notifications:['Notifications','System alerts and activity'],settings:['Settings','Manage parking configuration']};$('pageTitle').textContent=titles[page][0];$('pageSub').textContent=titles[page][1];document.querySelector('.sidebar').classList.remove('open');if(page==='reports')renderReports();if(page==='notifications')renderNotices();if(page==='settings')renderSettings();}
function downloadCSV(filename,rows){const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=filename;a.click();URL.revokeObjectURL(a.href);}
function downloadPDF(title,lines){if(!window.jspdf?.jsPDF){toast('PDF library unavailable. Check your internet connection.');return;}const pdf=new window.jspdf.jsPDF();pdf.setFontSize(18);pdf.text(title,15,20);pdf.setFontSize(11);lines.forEach((line,i)=>pdf.text(String(line),15,35+i*9));pdf.save(title.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.pdf');}
function downloadTicket(){if(!selectedTicket)return;const t=selectedTicket;downloadPDF('ParkSmart Parking Ticket',[`Ticket: ${t.ticketId}`,`Vehicle: ${t.vehicleNumber}`,`Type: ${t.vehicleType}`,`Entry: ${dateTime(t.entryTime)}`,`Floor: ${t.floor}`,`Slot: ${t.slotId}`,`Gate: ${t.entryGate}`]);}
function exportHistory(){downloadCSV('ParkSmart-History.csv',[['Ticket','Vehicle','Type','Entry','Exit','Floor','Slot','Duration','Amount','Payment','Status'],...state.tickets.map(t=>[t.ticketId,t.vehicleNumber,t.vehicleType,t.entryTime,t.exitTime,t.floor,t.slotId,t.durationHours,t.amount,t.paymentMethod,t.status])]);}
function simulate(action){if(action==='entry'){const type=types[Math.floor(Math.random()*types.length)];try{const t=createEntry({vehicleNumber:'DEMO '+Math.floor(1000+Math.random()*9000),vehicleType:type,driverName:'Demo Driver',contact:'',entryGate:'Gate 1',requirement:'none'});showTicket(t);}catch(e){toast(e.message);}}else if(action==='exit'){const t=activeTickets()[0];if(!t)return toast('No active vehicle to exit.');t.exitTime=now();t.status='Completed';t.durationHours=durationHours(t);t.amount=feeFor(t);t.paymentMethod='Cash';state.payments.unshift({ticketId:t.ticketId,amount:t.amount,method:'Cash',time:t.exitTime,vehicleNumber:t.vehicleNumber});const s=state.slots.find(x=>x.id===t.slotId);if(s)setSlotStatus(s,'Available');log(`Simulated exit for ${t.vehicleNumber}`);}else if(action==='occupy'||action==='full'){const free=state.slots.filter(s=>s.status==='Available');const count=action==='full'?free.length:1;free.slice(0,count).forEach((s,i)=>{s.status='Occupied';s.vehicleNumber='SIM '+Math.floor(1000+Math.random()*9000);s.vehicleType='Car';s.ticketId='SIM-'+Date.now()+'-'+i;s.updatedAt=now();});if(action==='full')notify('Parking facility full','All available spaces have been occupied in demo simulation.','warning');}else if(action==='vacate'){const s=state.slots.find(x=>x.status==='Occupied');if(s){const t=state.tickets.find(x=>x.ticketId===s.ticketId&&x.status==='Active');if(t){t.status='Completed';t.exitTime=now();t.durationHours=durationHours(t);t.amount=feeFor(t);t.paymentMethod='Cash';state.payments.unshift({ticketId:t.ticketId,amount:t.amount,method:'Cash',time:t.exitTime,vehicleNumber:t.vehicleNumber});}setSlotStatus(s,'Available');}else return toast('No occupied slot to vacate.');}else if(action==='reset'){state=makeInitialState();notify('Demo reset','All 150 spaces have been reset to Available.');}save();refreshAll();toast('Simulation updated.');}
function bind(){
 $('todayLabel').textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
 $('nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)go(b.dataset.page);});document.addEventListener('click',e=>{const b=e.target.closest('[data-goto]');if(b)go(b.dataset.goto);});$('menuBtn').onclick=()=>$('menuBtn').closest('.main').previousElementSibling.classList.toggle('open');
 renderFloorTabs();$('floorTabs').onclick=e=>{const b=e.target.closest('[data-floor]');if(!b)return;activeFloor=b.dataset.floor;renderFloorTabs();renderParking();};$('statusFilter').onchange=renderParking;$('typeFilter').onchange=renderParking;$('slotGrid').onclick=e=>{const b=e.target.closest('[data-slot]');if(b)showSlot(b.dataset.slot);};
 $('entryForm').onsubmit=e=>{e.preventDefault();const data={vehicleNumber:$('regNo').value,vehicleType:$('vehicleType').value,driverName:$('driverName').value,contact:$('contact').value,entryGate:$('entryGate').value,requirement:$('requirement').value};try{const t=createEntry(data);$('entryMessage').textContent=`Ticket generated successfully. Assigned slot: ${t.slotId}`;$('entryMessage').className='message success';e.target.reset();refreshAll();showTicket(t);}catch(err){$('entryMessage').textContent=err.message;$('entryMessage').className='message';}};
 $('searchExitBtn').onclick=findExit;$('exitSearch').addEventListener('keydown',e=>{if(e.key==='Enter')findExit();});['historySearch','historyStatus','historyType'].forEach(id=>$(id).addEventListener('input',renderHistory));$('exportHistory').onclick=exportHistory;
 $('closeTicket').onclick=()=>$('ticketModal').classList.add('hidden');$('ticketModal').onclick=e=>{if(e.target.id==='ticketModal')e.currentTarget.classList.add('hidden');};$('downloadTicket').onclick=downloadTicket;$('printTicket').onclick=()=>window.print();
 $('ratesForm').onsubmit=e=>{e.preventDefault();types.forEach((t,i)=>{state.rates[t]={first:Number($(`rate-${i}-first`).value),extra:Number($(`rate-${i}-extra`).value)};});save();toast('Parking rates saved.');};$('updateSlot').onclick=()=>{const s=state.slots.find(x=>x.id===$('manageSlot').value);if(!s)return;if(s.status==='Occupied')return toast('Exit the vehicle before changing an occupied slot.');setSlotStatus(s,$('manageStatus').value);save();refreshAll();toast(`${s.id} updated.`);};
 $('clearNotices').onclick=()=>{state.notifications.forEach(n=>n.read=true);save();renderNotices();};$('reportCsv').onclick=()=>downloadCSV('ParkSmart-Report.csv',[['Ticket','Vehicle','Type','Entry','Exit','Amount','Payment'],...state.tickets.map(t=>[t.ticketId,t.vehicleNumber,t.vehicleType,t.entryTime,t.exitTime,t.amount,t.paymentMethod])]);$('reportPdf').onclick=()=>downloadPDF('ParkSmart Analytics',[`Total spaces: 150`,`Occupied: ${occupiedCount()}`,`Available: ${state.slots.filter(s=>s.status==='Available').length}`,`Total revenue: ${money(state.payments.reduce((a,p)=>a+p.amount,0))}`,`Total tickets: ${state.tickets.length}`]);
 $('simEntry').onclick=()=>simulate('entry');$('simExit').onclick=()=>simulate('exit');$('simOccupy').onclick=()=>simulate('occupy');$('simVacate').onclick=()=>simulate('vacate');$('simFull').onclick=()=>simulate('full');$('resetDemo').onclick=()=>{if(confirm('Reset all demo parking data? This will erase local tickets and payments.'))simulate('reset');};
}
async function startParkSmart(){
    try {
        await load();
        bind();
        refreshAll();
        go('dashboard');
        console.log('ParkSmart data loaded from Supabase.');
    } catch (error) {
        console.error('Could not load ParkSmart data:', error);
        const message = document.createElement('div');
        message.className = 'supabase-error';
        message.innerHTML = '<b>Could not load ParkSmart data from Supabase.</b><br>' +
            String(error.message || error) +
            '<br>Check the SQL setup and Row Level Security policies. Press F12 → Console for details.';
        document.body.prepend(message);
    }
}

window.supabaseReady
    .then(() => startParkSmart())
    .catch(error => {
        console.error('ParkSmart could not start:', error);
        const message = document.createElement('div');
        message.className = 'supabase-error';
        message.innerHTML = '<b>ParkSmart could not connect to Supabase.</b><br>' +
            String(error.message || error) +
            '<br>Check js/supabase-config.js, Anonymous Sign-ins and SQL setup. Press F12 → Console for details.';
        document.body.prepend(message);
    });
