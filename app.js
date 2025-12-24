// app.js

// app.js

// 1. 地図初期化（Leaflet）
const map = L.map('map', {
    center: [35.5, 137.8],
    zoom: 9,
    zoomControl: false,
    maxZoom: 18,
    minZoom: 7
});

L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png').addTo(map);

// 2. 路線レイヤー
const routeLine = L.polyline(IIDA_COORDS, { color: '#111', weight: 2 }).addTo(map);
const activeLine = L.polyline([], { color: '#00ffcc', weight: 3 }).addTo(map);
const trainMarker = L.circleMarker([0,0], { radius: 6, color: '#fff', fillColor: '#00ffcc', fillOpacity: 1 }).addTo(map);

// 3. 駅・ラベル生成
const stationGroups = [];
STATIONS.forEach(s => {
    const marker = L.circleMarker([s.lat, s.lng], {
        radius: s.p === 1 ? 3 : 1.5,
        color: s.p === 1 ? '#666' : '#222',
        fillColor: '#000',
        fillOpacity: 1
    }).addTo(map);

    // ラベル（Tooltip）設定
    marker.bindTooltip(s.name, {
        permanent: true,
        direction: 'right',
        offset: [8, 0],
        className: 'station-label'
    });

    stationGroups.push({ marker, priority: s.p });
});

// 4. ズーム連動 LOD (Level of Detail) ロジック
function updateLOD() {
    const zoom = map.getZoom();
    
    // ズーム倍率に合わせてフォントサイズを「画面上での見た目」で一定にする
    // 遠いときは小さく、近いときは大きく（一律化への調整）
    const fontSize = Math.max(10, zoom * 1.2); 

    stationGroups.forEach(obj => {
        const tooltip = obj.marker.getTooltip();
        const el = tooltip.getElement();
        if (!el) return;

        // 表示・非表示の閾値
        let visible = false;
        if (zoom <= 9 && obj.priority === 1) visible = true;
        else if (zoom > 9 && zoom <= 11 && obj.priority <= 2) visible = true;
        else if (zoom > 11) visible = true;

        el.style.display = visible ? 'block' : 'none';
        
        // 文字サイズの均一化（ズームが深いときは全駅同じ太さに）
        el.style.fontSize = `${fontSize}px`;
        if (zoom > 13) {
            el.style.fontWeight = "normal";
            el.style.color = "#fff";
        } else if (obj.priority === 1) {
            el.style.fontWeight = "bold";
            el.style.color = "#00ffcc";
        }
    });
}

map.on('zoomend', updateLOD);
map.on('ready', updateLOD); // 初回実行

// --- 以下、タイマー/移動ロジック（前回の内容） ---
// (ここに interpolatePosition と update 関数、start.onclick を記述)

// 6. ロジック変数
let startAt = null;
let timerInt = null;
const todayKey = () => "sum_iida_leaflet_v1_" + new Date().toISOString().slice(0,10);
const getSum = () => Number(localStorage.getItem(todayKey()) || 0);

// 現在の合計分数(sum)から、地図上の[lat, lng]を割り出す関数
function interpolatePosition(totalMin) {
    const maxT = STATIONS[STATIONS.length - 1].t;
    const progress = Math.min(totalMin, maxT);
    
    for (let i = 0; i < STATIONS.length - 1; i++) {
        const s1 = STATIONS[i];
        const s2 = STATIONS[i+1];
        if (progress >= s1.t && progress <= s2.t) {
            const ratio = (progress - s1.t) / (s2.t - s1.t);
            const lat = s1.lat + (s2.lat - s1.lat) * ratio;
            const lng = s1.lng + (s2.lng - s1.lng) * ratio;
            return { pos: [lat, lng], station: s1 };
        }
    }
    return { pos: [STATIONS[STATIONS.length-1].lat, STATIONS[STATIONS.length-1].lng], station: STATIONS[STATIONS.length-1] };
}

function update(tempSum) {
    const sum = (tempSum !== undefined) ? tempSum : getSum();
    const result = interpolatePosition(sum);
    
    // 電車マーカーの移動
    trainMarker.setLatLng(result.pos);

    // 軌跡（光る線）の計算
    // 現在地より手前にある全ての駅座標 + 現在の補間座標
    const passedCoords = STATIONS
        .filter(s => s.t <= sum)
        .map(s => [s.lat, s.lng]);
    passedCoords.push(result.pos);
    
    activeLine.setLatLngs(passedCoords);

    // サイドバーのテキスト更新
    document.getElementById("cur-st-jp").textContent = result.station.name;
    document.getElementById("progress-pc").textContent = ((sum / 460) * 100).toFixed(2) + "%";
}

// 7. ボタンイベント
document.getElementById("start").onclick = function() {
    if(startAt) { // STOP処理
        clearInterval(timerInt);
        const add = (Date.now() - startAt) / 60000;
        localStorage.setItem(todayKey(), getSum() + add);
        startAt = null;
        this.textContent = "ENGAGE";
        this.classList.remove("active");
        update();
    } else { // START処理
        startAt = Date.now();
        this.textContent = "ARRIVE";
        this.classList.add("active");
        timerInt = setInterval(() => {
            const elapsed = (Date.now() - startAt) / 1000;
            document.getElementById("timer").textContent = 
                Math.floor(elapsed/60).toString().padStart(2,'0') + ":" + Math.floor(elapsed%60).toString().padStart(2,'0');
            update(getSum() + (elapsed/60));
        }, 500);
    }
};

// 初回表示
update();
