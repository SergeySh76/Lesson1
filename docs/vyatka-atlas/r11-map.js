/* Vyatka Atlas R11: no hover popups. All marker clicks open the right sidebar. */
(function atlasR11(){
"use strict";
let initialized=false;
let mapMarkers=new Map();
let selectedId=null;
let currentFocus=null;
let numRendered=0;
const $r=id=>document.getElementById(id);
function itemTitle(r){return r.category==="Клады"?"Клад":r.category;}
function afterLoad(){
  if(initialized||typeof DATA==="undefined"||!DATA||!Array.isArray(DATA.records)||!map||typeof L==="undefined")return false;
  initialized=true;
  const baseChoose=choose;
  const baseList=listForTab;
  const baseOnSelect=onSelect;
  const baseFilter=filterData;
  const oldLayer=layer;
  if(oldLayer)map.removeLayer(oldLayer);
  if(map.closePopup)map.closePopup();
  const canCluster=typeof L.markerClusterGroup==="function";
  layer=canCluster?L.markerClusterGroup({
    maxClusterRadius:58,zoomToBoundsOnClick:false,spiderfyOnMaxZoom:true,
    showCoverageOnHover:false,spiderfyDistanceMultiplier:2.4,
    iconCreateFunction:function(c){
      const n=c.getChildCount();
      const tally={};
      for(const child of c.getAllChildMarkers()){
        const key=child._atlasRec?.category||"Археология";
        tally[key]=(tally[key]||0)+1;
      }
      const dominant=Object.keys(tally).sort((a,b)=>tally[b]-tally[a])[0];
      const shade=clr[dominant]||"#245577";
      return L.divIcon({className:"r11-cluster-icon",
        html:'<span class="r11-cluster-pin" style="background:'+shade+'">'+n+'</span>',
        iconSize:[42,42],iconAnchor:[21,21]});
    }
  }):L.layerGroup();
  layer.addTo(map);
  map.on("popupopen",function(ev){if(ev.popup)map.closePopup(ev.popup);});
  if(canCluster){
    layer.on("clusterclick",function(e){
      if(e.originalEvent&&e.originalEvent.preventDefault)e.originalEvent.preventDefault();
      const group=e.layer.getAllChildMarkers().map(m=>m._atlasRec).filter(Boolean);
      group.sort((a,b)=>a.name.localeCompare(b.name,"ru"));
      const detail=$r("detail");
      if(detail&&group.length){
        detail.innerHTML='<h3>Группа объектов ('+group.length+')</h3>'+
          '<p>На этом участке карты сгруппировано несколько ориентиров. Выберите конкретную запись:</p>'+
          '<div class="r11-group-list">'+group.map(r=>
            '<button type="button" data-r11-select="'+esc(r.id)+'">'+
            '<i class="r11-spot" style="background:'+esc(clr[r.category]||"#72869a")+'"></i>'+
            esc(r.name)+' <small>'+esc(r.category)+'</small></button>').join("")+'</div>';
        detail.scrollTop=0;
      }
      const count=e.layer.getChildCount();
      if(count>16)e.layer.zoomToBounds();else e.layer.spiderfy();
    });
  }
  listForTab=function(){
    if(tab==="treasures"||tab==="research"){
      if(tab==="treasures")return DATA.records.filter(r=>r.category==="Клады").map(r=>({
        id:r.id,name:r.name,subtitle:(r.treasure?.reported_find_date||r.date||"")+
        " · "+(r.treasure?.material||"монеты"),
        search:[r.id,r.name,r.summary,r.historical_location,r.date,r.source,r.treasure?.coin_period].join(" "),
        record:r}));
      return (DATA.sources||[]).map(s=>({
        id:s.id,name:s.title,subtitle:(s.year||"")+" · "+(s.kind||"исследование"),
        search:[s.title,s.kind,s.notes,s.relevance,s.year].join(" "),source:s
      }));
    }
    return baseList();
  };
  filterData=function(){
    baseFilter();
    if(tab==="treasures")$r("status").textContent="Кладов и кладовых сообщений: "+$r("list").querySelectorAll(".entry").length;
    if(tab==="research")$r("status").textContent="Исследований и внешних источников: "+$r("list").querySelectorAll(".entry").length;
  };
  onSelect=function(id){
    if(tab==="treasures")return choose(id,true);
    if(tab==="research"){
      const src=(DATA.sources||[]).find(s=>s.id===id);
      if(!src)return;
      $r("detail").innerHTML='<h3>'+esc(src.title)+'</h3>'+
        '<p class="soft"><b>Номер:</b> '+esc(src.id)+' · <b>Тип:</b> '+esc(src.kind||"")+'</p>'+
        '<p><b>Год:</b> '+esc(src.year||"Не указан")+'</p>'+
        '<p><b>Что даёт исследованию:</b> '+esc(src.relevance||"")+'</p>'+
        '<p><b>Статус проверки:</b> '+esc(src.status||"")+'</p>'+
        '<p>'+esc(src.notes||"")+'</p>'+
        (typeof src.url==="string"&&/^https:\/\//.test(src.url)?'<p><a href="'+esc(src.url)+'" target="_blank" rel="noopener noreferrer">Открыть публикацию или каталог</a></p>':"");
      $r("detail").scrollTop=0;
      document.querySelectorAll(".entry").forEach(el=>el.classList.toggle("active",el.dataset.id===id));
      return;
    }
    return baseOnSelect(id);
  };
  function treasurePanel(r){
    const t=r.treasure;if(!t)return "";
    const lines=[
      ["Обнаружение",t.reported_find_date],
      ["Период чеканки",t.coin_period],
      ["Монет / состав",t.quantity],
      ["Металл",t.metal],
      ["Степень проверки",t.research_status],
      ["Номер записи в научной публикации",t.source_item_number]
    ].filter(row=>row[1]!==""&&row[1]!==null&&row[1]!==undefined);
    return '<div class="r11-treasure-details"><b>Нумизматические сведения</b>'+
      lines.map(([key,value])=>'<p><b>'+esc(key)+':</b> '+esc(value)+'</p>').join("")+
      '<p>Эта запись описывает уже опубликованную находку, а не предполагаемое место существующего клада.</p></div>';
  }
  function markSelectedInRightColumn(r){
    const shouldTreasure=r.category==="Клады";
    const targetTab=shouldTreasure?"treasures":"objects";
    if(tab!==targetTab){
      tab=targetTab;
      document.querySelectorAll("[data-tab]").forEach(btn=>btn.classList.toggle("sel",btn.dataset.tab===tab));
    }
    filterData();
    let el=[...document.querySelectorAll(".entry")].find(x=>x.dataset.id===r.id);
    if(!el){
      for(const f of ["search","category","region","geofilter","sourcefilter"])if($r(f))$r(f).value="";
      filterData();
      el=[...document.querySelectorAll(".entry")].find(x=>x.dataset.id===r.id);
    }
    if(el&&el.scrollIntoView)el.scrollIntoView({block:"nearest",behavior:"smooth"});
  }
  choose=function(id,fly){
    const r=DATA.records.find(x=>x.id===id);
    if(!r)return;
    selectedId=id;
    markSelectedInRightColumn(r);
    baseChoose(id,fly);
    const detail=$r("detail");
    if(detail){
      const extra=treasurePanel(r);
      if(extra)detail.insertAdjacentHTML("beforeend",extra);
      detail.scrollTop=0;
    }
    const item=[...document.querySelectorAll(".entry")].find(x=>x.dataset.id===id);
    if(item&&item.scrollIntoView)item.scrollIntoView({block:"nearest",behavior:"smooth"});
  };
  focusMapRecord=function(r,animate){
    if(!map||!focusLayer||!r.map_target)return;
    focusLayer.clearLayers();
    currentFocus=r.id;
    const t=r.map_target,estimated=t.level==="APPROXIMATE_ANCHOR_NOT_FIND_SITE";
    const circle=L.circle([t.latitude,t.longitude],{
      radius:t.radius_km*1000,color:estimated?"#d19027":clr[r.category]||"#337f92",
      weight:2.4,dashArray:estimated?"7 6":undefined,
      fillColor:clr[r.category]||"#337f92",fillOpacity:0.055,interactive:false
    }).addTo(focusLayer);
    if(animate){
      const zoom=t.radius_km<=3?13:t.radius_km<=10?11:t.radius_km<=25?9:t.radius_km<=75?7:t.radius_km<=180?6:5;
      map.flyToBounds(circle.getBounds(),{padding:[40,40],maxZoom:zoom,duration:.75});
    }
  };
  updateMap=function(){
    if(!DATA||!map||!layer)return;
    if(numRendered===DATA.records.length)return;
    numRendered=DATA.records.length;
    layer.clearLayers();
    mapMarkers.clear();
    const nodes=[];
    for(const r of DATA.records){
      const t=r.map_target;if(!t)continue;
      const approx=t.level==="APPROXIMATE_ANCHOR_NOT_FIND_SITE";
      const shade=clr[r.category]||"#73879a";
      const element='<span class="r11-marker'+(approx?' approx':'')+'" style="background:'+shade+'"></span>';
      const marker=L.marker([t.latitude,t.longitude],{
        icon:L.divIcon({className:"r11-marker-icon",html:element,iconSize:[29,29],iconAnchor:[14,14]}),
        keyboard:true
      });
      marker._atlasRec=r;
      marker.on("click",function(){choose(r.id,true);});
      mapMarkers.set(r.id,marker);
      nodes.push(marker);
    }
    if(layer.addLayers)layer.addLayers(nodes);
    else nodes.forEach(marker=>layer.addLayer(marker));
    const summary=$r("r11-map-count");
    if(summary)summary.textContent="На карте: "+nodes.length+" учётных меток. Совпадающие точки собраны в группы. Нажмите на точку — её данные откроются справа.";
  };
  function renderLegend(){
    const box=$r("r11-legend");if(!box)return;
    const count=new Map();
    DATA.records.forEach(r=>count.set(r.category,(count.get(r.category)||0)+1));
    const order=["Археология","Клады","Геология","Палеонтология","Метеорит","Болид","Ударная структура","Предания","Гипотеза","Историческая география"];
    const title={"Археология":"Археологические находки и памятники","Клады":"Клады и монетные комплексы",
    "Геология":"Геологические объекты","Палеонтология":"Окаменелости и древняя фауна",
    "Метеорит":"Метеориты","Болид":"Наблюдения метеоров и болидов",
    "Ударная структура":"Ударные структуры","Предания":"Народные предания",
    "Гипотеза":"Гипотетические памятники","Историческая география":"Исторические ориентиры"};
    box.innerHTML='<h2>Цветовые обозначения</h2><div class="r11-legend-rows">'+order.filter(k=>count.has(k)).map(k=>
      '<span class="r11-legend-item"><i class="r11-legend-dot" style="background:'+esc(clr[k]||"#72869a")+'"></i>'+
      esc(title[k]||k)+' <b>('+count.get(k)+')</b></span>').join("")+'</div>'+
      '<p class="r11-info">Число внутри крупной метки показывает группу объектов. Цвет группы соответствует наиболее многочисленной категории внутри неё. '+
      'Сплошной кружок обозначает исходную координату, пунктирный ободок — условный ориентир. '+
      'При нажатии данные выбранного объекта появляются в правой колонке; всплывающих окон на карте нет.</p>';
  }
  document.addEventListener("click",function(event){
    const button=event.target.closest("[data-r11-select]");
    if(!button)return;
    event.preventDefault();
    choose(button.dataset.r11Select,true);
  });
  renderLegend();
  updateMap();
  const existing=DATA.records.find(r=>r.id===selected);
  if(existing)choose(existing.id,false);
  else if(DATA.records.length)choose(DATA.records[0].id,false);
  document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{tab=btn.dataset.tab;filterData();}));
  // Sanity checks during runtime, visible in developer console, do not assert false success.
  if(mapMarkers.size!==DATA.records.length)console.warn("Atlas: not every source record has a marker",mapMarkers.size,DATA.records.length);
}
let tries=0;
function boot(){
  if(afterLoad())return;
  if(++tries<90)setTimeout(boot,180);
}
boot();
})();
