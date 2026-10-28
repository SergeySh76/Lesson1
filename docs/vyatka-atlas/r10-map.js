
(function r10AtlasMap(){
"use strict";
let started=false;
function initialize(){
  if(started)return;
  if(typeof L==="undefined"||typeof DATA==="undefined"||!DATA||!map){
    setTimeout(initialize,150);
    return;
  }
  started=true;
  const r10PreviousChoose=choose;
  let popup=null,closeTimer=null,pinned=false,moveNonce=0;
  let markersById=new Map();
  const approximate=r=>r.map_target?.level==="APPROXIMATE_ANCHOR_NOT_FIND_SITE";
  const validLink=u=>typeof u==="string"&&/^https:\/\/[^\s"'<>]+$/i.test(u);
  const link=(url,label)=>validLink(url)?'<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(label)+'</a>':"";
  function sourceEvidence(r){
    const ev=(DATA.evidence||[]).filter(e=>(e.object_ids||[]).includes(r.id));
    if(!ev.length)return '<p class="r10-muted">Отдельный абзац пока не сопоставлен с этой записью. Смотрите её основной источник.</p>';
    return ev.map(e=>{
      const doc=(DATA.documents||[]).find(d=>d.id===e.doc_id);
      const pages=e.page?('PDF с. '+esc(e.page)+(e.page_end&&e.page_end!==e.page?('–'+esc(e.page_end)):"")):"Номер страницы не установлен";
      return '<div class="r10-ev"><div class="r10-muted"><b>'+esc(e.id)+'</b> · '+esc(e.doc_id||"Без DOC-ID")+' · '+pages+
      (e.printed_page?' · печ. с. '+esc(e.printed_page):"")+'</div>'+
      (e.paragraph?'<div><b>Абзац:</b> '+esc(e.paragraph)+'</div>':"")+
      '<p>'+esc(e.summary||"Содержание не указано")+'</p>'+
      (e.kind?'<div class="r10-muted">Тип: '+esc(e.kind)+'</div>':"")+
      (e.confidence?'<div class="r10-muted">Подтверждение: '+esc(e.confidence)+'</div>':"")+
      (doc?.neb_url?'<div>'+link(doc.neb_url,"Открыть карточку НЭБ")+'</div>':"")+
      '</div>';
    }).join("");
  }
  function popupContent(r){
    const t=r.map_target;
    const isApprox=approximate(r);
    const factual=Number.isFinite(r.latitude)&&Number.isFinite(r.longitude);
    const doc=r.doc_id?DATA.documents.find(d=>d.id===r.doc_id):null;
    const block=isApprox?
    '<div class="r10-warning"><b>Условная область.</b> Центр и круг служат только ориентиром. Это <b>не установленная точка находки и не фактическая граница памятника</b>.</div>':
    '<div class="r10-ok"><b>Исходная географическая точка.</b> Нарисованный радиус — только радиус обзора, а не точность измерения и не установленная зона падения.</div>';
    const facts=[
      ["ID",r.id],["Категория",r.category],["Подраздел",r.subgroup],
      ["Географический статус",groupLabel(r)],["Подтверждение",r.verification],
      ["Дата события / находки",r.date],["Исторический ориентир",r.historical_location],
      ["Описание",r.summary],["Тип координат",coordRole(r)],
      ["Центр области",t.anchor_name],["Радиус",Number(t.radius_km).toLocaleString("ru")+" км"],
      ["Основание радиуса",t.explanation],
      ["Координаты центра области WGS84",t.latitude.toFixed(6)+", "+t.longitude.toFixed(6)],
      ["Исходные координаты WGS84",factual?(r.latitude.toFixed(6)+", "+r.longitude.toFixed(6)):"Отсутствуют"],
      ["Первичный источник",r.source],["DOC-ID",r.doc_id],["PDF-страница/раздел",r.page_label],
      ["Дополнительные замечания",r.notes]
    ].filter(([k,v])=>String(v??"").trim().length).map(([k,v])=>'<div class="r10-fact"><b>'+esc(k)+':</b> '+esc(v)+'</div>').join("");
    const links=[
      link(r.external_url,"Внешний источник"),
      doc?.neb_url?link(doc.neb_url,"Карточка НЭБ"):"",
      t.anchor_source?link(t.anchor_source,"Источник географического ориентира"):"",
      link("https://www.openstreetmap.org/?mlat="+t.latitude+"&mlon="+t.longitude+"#map=10/"+t.latitude+"/"+t.longitude,"OpenStreetMap"),
      link("https://yandex.ru/maps/?ll="+t.longitude+"%2C"+t.latitude+"&z=10","Яндекс Карты"),
      link(BASE,"Полный научный реестр")
    ].filter(Boolean).map(s=>'<div>'+s+'</div>').join("");
    return '<div class="r10-popup-card"><h3><span style="color:'+color(r)+'">●</span> '+esc(r.name)+'</h3>'+
    block+facts+(links?'<h4>Открыть источники и карты</h4>'+links:"")+
    '<h4>Исторические свидетельства и страницы</h4>'+sourceEvidence(r)+
    '<button type="button" class="r10-button" data-r10-choose="'+esc(r.id)+'">Перейти к объекту и его радиусу</button></div>';
  }
  function groupContent(group){
    return '<div class="r10-popup-card"><h3>В этой точке '+group.length+' записей</h3>'+
    '<p class="r10-muted">Совпадающие или близкие ориентиры сгруппированы. Нажмите на название для перехода, наведите курсор для просмотра всех его сведений. Нажатие на метку группы увеличит карту или развернёт точки.</p>'+
    '<div class="r10-cluster-list">'+group.map(r=>'<button type="button" data-r10-choose="'+esc(r.id)+'" data-r10-preview="'+esc(r.id)+'">'+
    '<span style="color:'+color(r)+'">●</span> '+esc(r.name)+
    (approximate(r)?' · ≈'+r.map_target.radius_km+' км':"")+'</button>').join("")+'</div>'+
    '<div class="r10-cluster-preview"><p class="r10-muted">Наведите на название или щёлкните для подробной карточки.</p></div></div>';
  }
  function cancelClose(){if(closeTimer){clearTimeout(closeTimer);closeTimer=null;}}
  function closeLater(){
    cancelClose();
    if(!pinned)closeTimer=setTimeout(()=>{if(map&&popup){map.closePopup(popup);popup=null;}},750);
  }
  function showPopup(latlon,html,isPinned){
    if(!map)return;
    cancelClose();
    pinned=!!isPinned;
    const p=L.popup({className:"r10-hover-popup",autoClose:true,closeOnClick:false,closeButton:true,maxWidth:445,maxHeight:440,autoPan:true,autoPanPadding:[30,30]})
      .setLatLng(latlon).setContent(html);
    popup=p;
    map.openPopup(p);
  }
  function showRecord(r,isPinned){
    const t=r.map_target;
    if(!t)return;
    showPopup([t.latitude,t.longitude],popupContent(r),isPinned);
  }
  function showGroup(e){
    const children=e.layer.getAllChildMarkers().map(m=>m._atlasRecord).filter(Boolean);
    children.sort((a,b)=>a.name.localeCompare(b.name,"ru"));
    if(children.length)showPopup(e.layer.getLatLng(),groupContent(children),false);
  }
  function markerFor(r){
    const t=r.map_target,isApprox=approximate(r);
    const html='<span class="r10-map-pin'+(isApprox?' approx':'')+'" style="--r10-pin:'+color(r)+'" aria-label="'+esc(r.category)+'"></span>';
    const marker=L.marker([t.latitude,t.longitude],{
      icon:L.divIcon({className:"r10-marker-shell",html,iconSize:[29,29],iconAnchor:[14,14]}),
      title:r.name,keyboard:true
    });
    marker._atlasRecord=r;
    marker.on("mouseover",()=>showRecord(r,false));
    marker.on("mouseout",closeLater);
    marker.on("click",()=>{r10PreviousChoose(r.id,false);showRecord(r,true);});
    return marker;
  }
  function renderLegend(){
    const div=document.getElementById("r10-legend");
    if(!div)return;
    const tally=new Map();
    for(const r of DATA.records)tally.set(r.category,(tally.get(r.category)||0)+1);
    const keys=["Археология","Клады","Геология","Палеонтология","Метеорит","Болид","Ударная структура","Предания","Гипотеза","Историческая география"];
    const names={"Археология":"Археология — городища, курганы и орудия",
    "Клады":"Клады и монеты","Геология":"Геологические объекты",
    "Палеонтология":"Палеонтологические находки","Метеорит":"Метеориты",
    "Болид":"Болиды и наблюдения метеоров","Ударная структура":"Ударные структуры",
    "Предания":"Народные предания","Гипотеза":"Предполагаемые памятники",
    "Историческая география":"Историческая география"};
    div.innerHTML='<h2>Расшифровка цветов и обозначений на карте</h2><div class="r10-legend-grid">'+
    keys.filter(k=>tally.has(k)).map(k=>'<span class="r10-legend-entry"><i class="r10-color" style="background:'+color({category:k})+'"></i>'+
    esc(names[k]||k)+' <b>('+tally.get(k)+')</b></span>').join("")+'</div>'+
    '<div class="r10-legend-notes"><span><i class="r10-example-dot"></i>Сплошная точка — исходные координаты</span>'+
    '<span><i class="r10-example-dot approx"></i>Пунктирный ободок — приблизительный ориентир</span>'+
    '<span><b>Цифра внутри кружка</b> — несколько записей в группе. Нажмите, чтобы увеличить карту или раскрыть группу.</span></div>'+
    '<p class="r10-legend-notes">Показаны все 109 записей, в том числе 94 условных ориентира. Цвет обозначает раздел исследования, а не достоверность географической привязки.</p>';
  }
  updateMap=function(){
    if(!DATA||!map||!layer)return;
    layer.clearLayers();
    markersById=new Map();
    const group=(tab==="objects"?filtered:DATA.records);
    for(const r of group){
      if(!r.map_target)continue;
      const marker=markerFor(r);
      markersById.set(r.id,marker);
      layer.addLayer(marker);
    }
    const el=document.getElementById("r10-map-count");
    if(el)el.textContent="На карте: "+markersById.size+" учётных точек"+
      (markersById.size>1?" (совпадающие ориентиры сгруппированы)":"")+
      " · 15 исходных координат · 94 условных ориентиров в полном реестре";
  };
  focusMapRecord=function(r,fly){
    const t=r.map_target;
    if(!map||!focusLayer||!t)return;
    focusLayer.clearLayers();
    const circle=L.circle([t.latitude,t.longitude],{
      radius:t.radius_km*1000,color:approximate(r)?"#c17a21":color(r),weight:2.4,
      dashArray:approximate(r)?"8 6":undefined,fillColor:color(r),fillOpacity:.07,interactive:false
    }).addTo(focusLayer);
    if(fly){
      const limit=t.radius_km<=3?14:t.radius_km<=10?12:t.radius_km<=25?10:t.radius_km<=75?8:t.radius_km<=180?7:5;
      map.flyToBounds(circle.getBounds(),{padding:[34,34],maxZoom:limit,duration:.75});
    }
  };
  choose=function(id,fly){
    const r=DATA.records.find(x=>x.id===id);
    r10PreviousChoose(id,fly);
    if(r&&fly&&map){
      let done=false;
      const seq=++moveNonce;
      const show=()=>{if(done||seq!==moveNonce)return;done=true;showRecord(r,true);};
      map.once("moveend",show);
      setTimeout(show,900);
    }
  };
  // Replace the old 15-point-only layer with a layer holding every navigable record.
  if(layer)map.removeLayer(layer);
  if(typeof L.markerClusterGroup==="function"){
    layer=L.markerClusterGroup({
      maxClusterRadius:55,showCoverageOnHover:false,spiderfyOnMaxZoom:true,
      zoomToBoundsOnClick:true,spiderfyDistanceMultiplier:2.3,
      iconCreateFunction:function(cluster){
        const n=cluster.getChildCount(),big=n>12,size=big?43:37;
        return L.divIcon({className:"r10-cluster-shell",
          html:'<div class="r10-group-pin'+(big?' big':'')+'">'+n+'</div>',
          iconSize:[size,size],iconAnchor:[size/2,size/2]});
      }
    });
    layer.on("clustermouseover",showGroup);
    layer.on("clustermouseout",closeLater);
    layer.on("clusterclick",cancelClose);
  }else layer=L.layerGroup();
  layer.addTo(map);
  map.on("popupopen",function(ev){
    const el=ev.popup.getElement();
    if(!el)return;
    el.addEventListener("mouseenter",cancelClose);
    el.addEventListener("mouseleave",closeLater);
  });
  map.on("popupclose",()=>{cancelClose();popup=null;pinned=false;});
  document.addEventListener("click",function(ev){
    const button=ev.target.closest("[data-r10-choose]");
    if(!button||!DATA)return;
    ev.preventDefault();ev.stopPropagation();
    const id=button.getAttribute("data-r10-choose");
    cancelClose();
    map.closePopup();
    choose(id,true);
  });
  document.addEventListener("mouseover",function(ev){
    const el=ev.target.closest("[data-r10-preview]");
    if(!el||!DATA)return;
    const r=DATA.records.find(x=>x.id===el.getAttribute("data-r10-preview"));
    const area=el.closest(".r10-popup-card")?.querySelector(".r10-cluster-preview");
    if(r&&area)area.innerHTML=popupContent(r);
  });
  renderLegend();
  updateMap();
  if(selected){
    const s=DATA.records.find(x=>x.id===selected);
    if(s)focusMapRecord(s,false);
  }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize);
else initialize();
})();
