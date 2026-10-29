/* Vyatka Atlas R15: no hover popups. All marker clicks open the right sidebar. */
(function atlasR11(){
"use strict";
let initialized=false;
let mapMarkers=new Map();
let selectedId=null;
let currentFocus=null;
let numRendered=0;
const $r=id=>document.getElementById(id);
const LEGENDS=JSON.parse(document.getElementById("atlas-legend-data")?.textContent||"[]");
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
    if(tab==="legends")return LEGENDS.map(l=>({
      id:l.id,name:l.name,subtitle:l.genre+" · "+l.printed_page,
      search:[l.id,l.name,l.genre,l.summary,l.historical_place,l.territory,l.source].join(" "),legend:l
    }));
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
    document.body.classList.toggle("legend-mode",tab==="legends");
    baseFilter();
    if(tab==="legends")$r("status").textContent="Преданий и старинных рассказов: "+$r("list").querySelectorAll(".entry").length+". Доказанных кладов и точных мест здесь нет.";
    if(tab==="treasures")$r("status").textContent="Кладов и кладовых сообщений: "+$r("list").querySelectorAll(".entry").length;
    if(tab==="research")$r("status").textContent="Исследований и внешних источников: "+$r("list").querySelectorAll(".entry").length;
  };
  onSelect=function(id){
    if(tab==="legends"){
      const l=LEGENDS.find(x=>x.id===id);if(!l)return;
      const u=typeof l.source_url==="string"&&/^https:\/\//.test(l.source_url)?l.source_url:"";
      $r("detail").innerHTML=legendCardR15(l);
      $r("detail").scrollTop=0;
      if(focusLayer)focusLayer.clearLayers();
      if(map&&map.flyTo){const city=l.anchor_city;const p=city==="Слободской"?[58.731,50.178]:city==="Уржум"?[57.115,50.0]:[58.55,49.6];map.flyTo(p,city?8:6,{animate:true,duration:0.6});}
      document.querySelectorAll(".entry").forEach(el=>el.classList.toggle("active",el.dataset.id===id));
      $r("status").textContent="Показан только обзорный ориентир. Легенда не имеет опубликованной точки сокровищ.";
      return;
    }
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

  function buildNarrativeR15(r,ev){
  const seen=new Set();const original=String(r.summary||"").trim();
  const extracts=[];
  for(const e of ev){
    const s=String(e.summary||"").trim();
    if(!s||s===original||seen.has(s))continue;seen.add(s);
    extracts.push('<div class="r15-passage"><p>'+esc(s)+'</p><small>'+esc(e.doc_id||"Источник не установлен")+(e.page?" · PDF с. "+esc(e.page):"")+(e.paragraph?" · "+esc(e.paragraph):"")+'</small></div>');
  }
  return '<section class="r15-prose"><h4>Подробное описание находки</h4>'+
    '<p>'+esc(original||"Описание в исходном реестре ещё не подготовлено.")+'</p>'+
    (extracts.length?'<h5>Сведения из исторических публикаций и документов</h5>'+extracts.join(""):'<p class="r15-unknown">Дополнительные фрагменты исторического источника для этой карточки пока не извлечены; сведения требуют дальнейшей сверки.</p>')+
    (/Предания|Гипотеза/.test(r.category)?'<p class="r15-unknown">Это свидетельство о предании или гипотеза, а не документированное обнаружение предмета.</p>':"")+'</section>';
}
  function renderRecordR15(r){
 const ev=getEvidence(r);
 const t=r.map_target||null;
 const geoIsMapped=mapped(r);
 const coord=geoIsMapped ? ('В реестре есть опорная координата WGS84: '+Number(r.latitude).toFixed(6)+', '+Number(r.longitude).toFixed(6)+'. Она не обязательно обозначает точное место находки.') : 'Не установлены. Центр просмотра на карте обозначает только условный ориентир.';
 const mapBasis=t ? (t.level==="APPROXIMATE_ANCHOR_NOT_FIND_SITE"?'Условный ориентир, не точка находки. ':'Опорная географическая точка из базы. ')+(t.anchor_name||"")+'. '+(t.explanation||"") : 'В исходном реестре нет географической привязки.';
 let note=r.notes||'Дополнительное примечание не внесено.';
 let source=r.source||'Не установлен';
 let d=r.doc_id?DATA.documents.find(x=>x.id===r.doc_id):null;
 const sourceStatus=r.verification||"Степень проверки первоисточника отдельно не указана";
 const ext=(r.external_url&&/^https:\/\//.test(r.external_url))?'<p><a href="'+esc(r.external_url)+'" target="_blank" rel="noopener">Внешняя публикация</a></p>':"";
 const neb=(d?.neb_url&&/^https:\/\//.test(d.neb_url))?'<p><a href="'+esc(d.neb_url)+'" target="_blank" rel="noopener">Карточка первоисточника в НЭБ</a></p>':"";
 const others=ev.map(e=>{let x=DATA.documents.find(d=>d.id===e.doc_id);return x?.neb_url&&/^https:\/\//.test(x.neb_url)?'<a href="'+esc(x.neb_url)+'" target="_blank" rel="noopener">Документ '+esc(e.doc_id||"")+'</a>':null}).filter(Boolean);
 return '<h3>'+esc(r.name)+'</h3><span class="badge">'+esc(r.id)+'</span><span class="badge">'+esc(r.category)+'</span><span class="badge">'+esc(groupLabel(r))+'</span>'+
 '<section class="r15-fields">'+
 '<p><b>Исторический ориентир:</b> '+esc(r.historical_location||"Не установлен")+'</p>'+
 '<p><b>Датировка:</b> '+esc(r.date||"Не установлена")+'</p>'+
 '<p><b>Геопривязка:</b> '+esc(mapBasis)+'</p>'+
 '<p><b>Координаты находки:</b> '+esc(coord)+'</p>'+
 '<p><b>Первичный источник:</b> '+esc(source)+' '+esc(r.page_label||"")+' <span class="r15-unknown">('+esc(sourceStatus)+')</span></p>'+
 '<p><b>Примечание:</b> '+esc(note)+'</p></section>'+
 buildNarrativeR15(r,ev)+
 (r.treasure?treasurePanel(r):'')+
 (t?'<details class="r15-map-context"><summary>Картографический ориентир и его ограничения</summary>'+mapFocusCard(r)+'</details>':'')+
 '<section class="r15-source-links">'+neb+ext+(others.length?'<p>Дополнительные карточки: '+others.join(' · ')+'</p>':'')+'</section>';
}
  function legendCardR15(l){
 const sourceUrl=typeof l.source_url==="string"&&/^https:\/\//.test(l.source_url)?l.source_url:"";
 return '<h3>'+esc(l.name)+'</h3><p class="legend-caution">Историческое предание: существование клада не подтверждено. Точные координаты неизвестны.</p>'+
 '<section class="r15-fields"><p><b>Исторический ориентир:</b> '+esc(l.historical_place||"Не установлен")+'</p>'+
 '<p><b>Датировка:</b> '+esc(l.printed_page||"Не определена")+'</p>'+
 '<p><b>Геопривязка:</b> '+esc(l.territory||"Территория уточняется")+'. Только обзорная историко-географическая привязка.</p>'+
 '<p><b>Координаты находки:</b> Не установлены; легенда не является подтверждённой находкой.</p>'+
 '<p><b>Первичный источник:</b> '+esc(l.source||"Не указан")+' '+esc(l.pdf_page?"PDF с. "+l.pdf_page+"; ":"")+esc(l.printed_page||"")+'</p>'+
 '<p><b>Примечание:</b> '+esc(l.verification||"Требует проверки")+'</p></section>'+
 '<section class="r15-prose"><h4>Подробное описание предания</h4><p>'+esc(l.summary||"Дополнительные сведения отсутствуют.")+'</p><p class="r15-unknown">Пересказ ограничен текстом, уже внесённым в R14; предполагаемый клад не подтверждён.</p></section>'+
 (l.related_record?'<p><b>Связанный объект:</b> '+esc(l.related_record)+' (не точка клада)</p>':"")+
 (sourceUrl?'<p><a href="'+esc(sourceUrl)+'" target="_blank" rel="noopener noreferrer">Открыть публикацию или каталог</a></p>':"");
}
    choose=function(id,fly){
    const r=DATA.records.find(x=>x.id===id);if(!r)return;
    selectedId=id;
    markSelectedInRightColumn(r);
    // Preserve R14 original map-side effects, but never let baseChoose pan the map.
    baseChoose(id,false);
    const detail=$r("detail");
    if(detail){detail.innerHTML=renderRecordR15(r);detail.scrollTop=0;}
    const item=[...document.querySelectorAll(".entry")].find(x=>x.dataset.id===id);
    if(item&&item.scrollIntoView)item.scrollIntoView({block:"nearest",behavior:"smooth"});
    if(fly&&map&&r.map_target){
      const t=r.map_target;
      const zoom=t.radius_km>140?7:t.radius_km>35?8.3:10.6;
      map.flyTo([t.latitude,t.longitude],zoom,{animate:true,duration:0.75});
    }
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
  // R16: only visible records from the active catalogue filter create map markers.
  updateMap=function(){
    if(!map||!layer)return;
    const visible=new Set((tab==="objects"||tab==="treasures")?
      Array.from(document.querySelectorAll("#list .entry[data-id]"),el=>el.dataset.id):[]);
    layer.clearLayers();mapMarkers.clear();
    const nodes=[];
    for(const r of DATA.records){
      if(!visible.has(r.id)||!r.map_target)continue;
      const t=r.map_target;
      const approx=t.level==="APPROXIMATE_ANCHOR_NOT_FIND_SITE";
      const shade=clr[r.category]||"#64748B";
      const el='<span class="r11-marker'+(approx?' approx':'')+'" style="background:'+shade+'"></span>';
      const marker=L.marker([t.latitude,t.longitude],{
        icon:L.divIcon({className:"r11-marker-icon",html:el,iconSize:[29,29],iconAnchor:[14,14]}),keyboard:true
      });
      marker._atlasRec=r;
      marker.on("click",function(){
        const initialOverview=map&&map.getZoom&&map.getZoom()<9.7;
        choose(r.id,false);
        if(initialOverview&&map){
          map.flyTo([t.latitude,t.longitude],10.7,{animate:true,duration:0.75});
        }
      });
      mapMarkers.set(r.id,marker);nodes.push(marker);
    }
    if(layer.addLayers)layer.addLayers(nodes);else nodes.forEach(m=>layer.addLayer(m));
    const info=$r("r11-map-count");
    if(info)info.textContent="На карте отображается "+nodes.length+" меток выбранного раздела. Условные ориентиры не являются точными местами находок.";
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
    choose(button.dataset.r11Select,false);
  });
  // R16: filters live in the lower-left map panel and share the original sidebar list.
  const quickSpecs=[
    ["all","Все объекты","#1F2937","all"],
    ["Археология","Археология",clr["Археология"],"category"],
    ["Клады","Клады и монеты",clr["Клады"],"category"],
    ["legends","Клады — легенды","#C026D3","nomap"],
    ["Палеонтология","Палеонтология",clr["Палеонтология"],"category"],
    ["Геология","Геология",clr["Геология"],"category"],
    ["Метеорит","Метеориты",clr["Метеорит"],"category"],
    ["Болид","Болиды",clr["Болид"],"category"],
    ["Ударная структура","Ударные структуры",clr["Ударная структура"],"category"],
    ["Историческая география","Исторические ориентиры",clr["Историческая география"],"category"],
    ["Предания","Предания",clr["Предания"],"category"],
    ["Гипотеза","Гипотезы",clr["Гипотеза"],"category"],
    ["documents","Документы","#475569","nomap"],
    ["research","Исследования","#57718C","nomap"],
    ["toponyms","Топонимы","#0C8A8E","nomap"]
  ];
  const quickBox=$r("r16-filterbuttons");
  const quickCount=(key,group)=>key==="all"?DATA.records.length:key==="legends"?LEGENDS.length:
    key==="documents"?DATA.documents.length:key==="research"?(DATA.sources||[]).length:
    key==="toponyms"?DATA.toponyms.length:DATA.records.filter(r=>r.category===key).length;
  function quickSync(){
    if(!quickBox)return;
    const manual=!!($r("search")?.value||$r("region")?.value||$r("geofilter")?.value||$r("sourcefilter")?.value);
    const key=manual?"":tab==="objects"?($r("category")?.value||"all"):tab;
    for(const b of quickBox.querySelectorAll("[data-r16-filter]")){
      const on=b.dataset.r16Filter===key;
      b.classList.toggle("is-active",on);b.setAttribute("aria-pressed",String(on));
    }
  }
  function quickSelect(key){
    if(!DATA)return;
    for(const id of ["search","category","region","geofilter","sourcefilter"])if($r(id))$r(id).value="";
    selected=null;selectedId=null;currentFocus=null;
    if(focusLayer)focusLayer.clearLayers();
    if(key==="all"){tab="objects";}
    else if(["legends","documents","research","toponyms"].includes(key)){tab=key;}
    else if(key==="Клады"){tab="treasures";}
    else{tab="objects";$r("category").value=key;}
    document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("sel",b.dataset.tab===tab));
    filterData();
    if(map)map.setView([57.4,50.0],7,{animate:false});
    $r("detail").innerHTML='<h3>Выбран раздел</h3><p>Откройте запись в колонке справа или нажмите на видимый маркер. Клик по записи приближает карту; клик по маркеру на уже увеличенной карте сохраняет масштаб.</p>';
    if(key==="all")$r("status").textContent="Все объекты: сброшены поиск, территория, геофильтр и раздел.";
    else if(["legends","documents","research","toponyms"].includes(key))$r("status").textContent="Источниковые сведения выбранного раздела. Не создаём фиктивные координаты для документов или преданий.";
    quickSync();
  }
  if(quickBox){
    quickBox.innerHTML=quickSpecs.map(([key,title,shade,group])=>
      '<button type="button" class="r16-filter '+(group==="nomap"?"no-pin":"")+'" data-r16-filter="'+esc(key)+'" aria-pressed="false" style="--filter-color:'+shade+'">'+
      '<span class="r16-dot"></span><span>'+esc(title)+'</span><small>'+quickCount(key,group)+'</small></button>').join("");
    quickBox.addEventListener("click",function(ev){
      const button=ev.target.closest("[data-r16-filter]");
      if(button)quickSelect(button.dataset.r16Filter);
    });
    for(const id of ["search","category","region","geofilter","sourcefilter"]){
      const input=$r(id);
      if(input){input.addEventListener("input",quickSync);input.addEventListener("change",quickSync);}
    }
    document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",quickSync));
    quickSync();
  }
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
