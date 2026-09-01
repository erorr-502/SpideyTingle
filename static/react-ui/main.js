const { useEffect, useRef, useState } = React;

const nav = [
  ['tingle','01','TINGLE','CHECK IN','🕷️'],
  ['vent','02','VENT','TALK IT OUT','💬'],
  ['sense','03','SENSE','SPOT SIGNALS','🧠'],
  ['nudge','04','NUDGE','TINY RESET','⚡'],
  ['insight','05','INSIGHT','SEE TRENDS','📈'],
  ['loop','06','LOOP','YOUR RECEIPTS','🧾'],
  ['safety','07','SAFETY','SUPPORT WEB','🛡️']
];

const moods = [
  ['TANGLED','🕸️','tangled'],
  ['HEAVY','🌧️','heavy'],
  ['STEADY','😐','steady'],
  ['BRIGHT','✨','bright'],
  ['ELECTRIC','🕷️','electric']
];

function App(){
  const [active,setActive]=useState('tingle');
  const [dark,setDark]=useState(false);
  const [menu,setMenu]=useState(false);
  const [mood,setMood]=useState('');
  const [pulse,setPulse]=useState(false);
  const [stats,setStats]=useState({streak_days:0,avg_7:null,today_logged:false});
  const progress=useRef(null);

  useEffect(()=>{
    document.documentElement.dataset.theme=dark?'dark':'light';
    document.body.classList.toggle('react-dark',dark);
  },[dark]);

  useEffect(()=>{
    const onScroll=()=>{
      const max=document.documentElement.scrollHeight-innerHeight;
      if(progress.current) progress.current.style.width=`${max>0?(scrollY/max)*100:0}%`;
    };
    addEventListener('scroll',onScroll,{passive:true}); onScroll();
    return()=>removeEventListener('scroll',onScroll);
  },[]);

  useEffect(()=>{
    fetch('/static/react-ui/legacy-content.html').then(r=>r.text()).then(html=>{
      const host=document.getElementById('legacy-mount'); if(host) host.innerHTML=html;
      const s=document.createElement('script'); s.src='/static/script.js'; s.defer=true; document.body.appendChild(s);
    }).catch(()=>{});
  },[]);

  useEffect(()=>{
    let cancelled=false;
    const refreshStats=async()=>{
      try{
        const response=await fetch('/api/stats');
        if(response.ok&&!cancelled) setStats(await response.json());
      }catch(_error){ /* The interface remains useful when the API is unavailable. */ }
    };
    refreshStats();
    const timer=setInterval(refreshStats,15000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[]);

  useEffect(()=>{
    const closeMenu=(event)=>{if(event.key==='Escape') setMenu(false);};
    addEventListener('keydown',closeMenu);
    return()=>removeEventListener('keydown',closeMenu);
  },[]);

  const go=(id)=>{
    setActive(id); setMenu(false);

    // The legacy UI is injected after React mounts. Use its public bridge when
    // available, otherwise fall back to the real tab button. This keeps every
    // dashboard control working even if it is clicked immediately on load.
    if(id==='diary'){
      document.getElementById('diary-section')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }

    const activate=window.spideyActivateTab;
    if(typeof activate==='function') activate(id);
    else document.querySelector(`[data-tab="${id}"]`)?.click();

    requestAnimationFrame(()=>{
      document.getElementById(`panel-${id}`)?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  };

  const checkIn=()=>{
    setPulse(true);
    go('tingle');
    setTimeout(()=>{
      setPulse(false);
      const firstMood=document.querySelector('.mood-btn');
      firstMood?.focus({preventScroll:true});
    },250);
  };

  const randomMood=()=>{
    const m=moods[Math.floor(Math.random()*moods.length)];
    setMood(m[2]);
    document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('selected'));
    const btn=[...document.querySelectorAll('.mood-btn')].find(b=>b.textContent.toLowerCase().includes(m[0].toLowerCase()));
    btn?.click();
  };

  return React.createElement('div',{className:'app-shell'},
    React.createElement('div',{className:'scroll-progress'},React.createElement('span',{ref:progress})),
    React.createElement('div',{className:'comic-bg'}),
    React.createElement('div',{className:'halftone'}),

    React.createElement('aside',{className:`comic-sidebar ${menu?'open':''}`,id:'primary-navigation',ariaLabel:'SpideyTingle sections'},
      React.createElement('div',{className:'sidebar-brand'},
        React.createElement('div',{className:'logo-frame'},React.createElement('img',{src:'/static/assets/spideytingle-logo.png',alt:'SpideyTingle'})),
        React.createElement('div',null,React.createElement('div',{className:'brand-name'},'SPIDEY',React.createElement('span',null,'TINGLe')),React.createElement('div',{className:'brand-sub'},'YOUR EMOTIONAL SIXTH SENSE'))
      ),
      React.createElement('div',{className:'web-label'},'YOUR WEB · 7 STEPS'),
      React.createElement('nav',{className:'comic-nav'},nav.map(([id,num,title,sub,icon])=>
        React.createElement('button',{key:id,className:`nav-row ${active===id?'active':''}`,onClick:()=>go(id)},
          React.createElement('span',{className:'nav-icon'},icon),React.createElement('span',{className:'nav-num'},num),
          React.createElement('span',{className:'nav-text'},React.createElement('b',null,title),React.createElement('small',null,sub)),React.createElement('span',{className:'nav-arrow'},'›')
        )
      )),
      React.createElement('div',{className:'sidebar-bottom'},
        React.createElement('div',{className:'privacy-box'},React.createElement('span',{className:'privacy-dot'}),React.createElement('div',null,React.createElement('b',null,'PRIVATE BY DESIGN'),React.createElement('small',null,'Your reflections stay yours.'))),
        React.createElement('button',{className:'vibe-button',onClick:()=>setDark(v=>!v),ariaPressed:dark},'🌈 VIBE MODE: ',dark?'ON':'OFF')
      )
    ),

    React.createElement('button',{className:`nav-scrim ${menu?'visible':''}`,onClick:()=>setMenu(false),tabIndex:menu?0:-1,ariaLabel:'Close navigation'}),
    React.createElement('button',{className:'mobile-toggle',onClick:()=>setMenu(v=>!v),ariaExpanded:menu,ariaControls:'primary-navigation',ariaLabel:menu?'Close navigation':'Open navigation'},menu?'✕':'☰'),

    React.createElement('main',{className:'main-stage'},
      React.createElement('header',{className:'top-header'},
        React.createElement('div',{className:'issue-mark'},'MENTAL WELLNESS · ISSUE #01'),
        React.createElement('div',{className:'boost-bubble'},React.createElement('span',null,'TODAY’S BOOST'),React.createElement('p',null,'“You are stronger than you think.”'),React.createElement('small',null,'Even Spidey had tough days!')), 
        React.createElement('div',{className:'header-actions'},React.createElement('button',{className:'vibe-top',onClick:()=>setDark(v=>!v),ariaPressed:dark},'🌈 VIBE MODE: ',dark?'ON':'OFF'),React.createElement('button',{className:'theme-toggle',onClick:()=>setDark(v=>!v),ariaLabel:dark?'Use warm paper theme':'Use dark theme',title:dark?'Use warm paper theme':'Use dark theme'},dark?'☀':'◐'))
      ),

      React.createElement('section',{className:`hero-grid ${pulse?'pulse':''}`},
        React.createElement('div',{className:'hero-panel'},
          React.createElement('div',{className:'comic-tag red'},'FRIENDLY NEIGHBOURHOOD CHECK-IN'),
          React.createElement('h1',null,'HOW ARE',React.createElement('strong',null,'YOU, HERO?')), 
          React.createElement('p',null,'A daily check-in to understand your emotions, track your mood and get the support you deserve.'),
          React.createElement('div',{className:'hero-buttons'},React.createElement('button',{className:'primary-comic',onClick:checkIn},'🕷️ START MY CHECK-IN',React.createElement('span',null,'→')),React.createElement('button',{className:'secondary-comic',onClick:randomMood},'🎲 RANDOM MOOD')),
          React.createElement('div',{className:'hero-illustration'},React.createElement('div',{className:'spidey-silhouette'},'🕷️'),React.createElement('div',{className:'thwip'},'THWIP!'))
        ),
        React.createElement('div',{className:'mood-panel'},
          React.createElement('div',{className:'comic-tag yellow'},'HOW’S YOUR VIBE TODAY?'),
          React.createElement('h2',null,'PICK A MOOD'),React.createElement('p',null,'Choose what matches you best.'),
          React.createElement('div',{className:'mood-grid'},moods.map(([name,emoji,key])=>React.createElement('button',{key:key,className:`mood-tile ${mood===key?'chosen':''}`,onClick:()=>{setMood(key); document.querySelectorAll('.mood-btn').forEach(b=>{if(b.textContent.toLowerCase().includes(name.toLowerCase())) b.click()})}},React.createElement('span',null,emoji),React.createElement('b',null,name)))),
          React.createElement('button',{className:'custom-mood',onClick:()=>go('tingle')},'✎ CUSTOM MOOD')
        )
      ),

      React.createElement('section',{className:'stats-strip'},
        React.createElement('div',{className:'stat red-stat'},React.createElement('span',null,'CURRENT STREAK'),React.createElement('b',{id:'stat-streak'},stats.streak_days),React.createElement('small',null,stats.streak_days===1?'day':'days'),React.createElement('i',null,'🔥')),
        React.createElement('div',{className:'stat yellow-stat'},React.createElement('span',null,'TODAY'),React.createElement('b',{id:'stat-today'},stats.today_logged?'✓':'–'),React.createElement('small',null,stats.today_logged?'Checked in':'Not yet'),React.createElement('i',null,'▦')),
        React.createElement('div',{className:'stat blue-stat'},React.createElement('span',null,'7-CHECK AVG'),React.createElement('b',{id:'stat-average'},stats.avg_7===null?'–':`${stats.avg_7}/5`),React.createElement('small',null,stats.avg_7===null?'Start with one':'Your recent vibe'),React.createElement('i',null,'⌁')),
        React.createElement('div',{className:'stat purple-stat'},React.createElement('span',null,'YOUR WEB'),React.createElement('b',null,'7'),React.createElement('small',null,'Ways to reflect'),React.createElement('i',null,'🕸️'))
      ),

      React.createElement('section',{className:'feature-grid'},
        React.createElement('button',{className:'feature-card ai-card',onClick:()=>go('vent')},React.createElement('div',{className:'card-title'},'AI COMPANION'),React.createElement('p',null,'Ask. Vent. Reflect. Grow.'),React.createElement('div',{className:'speech'},'I’m here whenever you need to talk!'),React.createElement('div',{className:'mini-spidey'},'🕷️'),React.createElement('span',{className:'card-cta'},'CHAT NOW  ›')),
        React.createElement('button',{className:'feature-card nudge-card',onClick:()=>go('nudge')},React.createElement('div',{className:'card-title'},'TODAY’S NUDGE'),React.createElement('p',null,'One small reset can shift your day.'),React.createElement('div',{className:'nudge-message'},'TAKE A 5-MINUTE BREATH BREAK'),React.createElement('span',{className:'card-cta'},'I’LL TRY THIS')),
        React.createElement('button',{className:'feature-card trend-card',onClick:()=>go('insight')},React.createElement('div',{className:'card-title'},'MOOD TREND'),React.createElement('p',null,'Your emotional journey'),React.createElement('div',{className:'mini-chart'},[20,35,62,39,70,66,92].map((h,i)=>React.createElement('span',{key:i,style:{height:`${h}%`}}))),React.createElement('span',{className:'card-cta'},'VIEW INSIGHTS')),
        React.createElement('button',{className:'feature-card diary-card',onClick:()=>go('diary')},React.createElement('div',{className:'card-title'},'DIARY SPACE'),React.createElement('p',null,'Write your thoughts, track your growth.'),React.createElement('div',{className:'diary-book'},'📕'),React.createElement('span',{className:'card-cta'},'OPEN DIARY'))
      ),

      React.createElement('section',{className:'wellness-web'},React.createElement('div',null,React.createElement('h2',null,'YOUR WELLNESS WEB'),React.createElement('p',null,'Everything you need, all in one place.')),React.createElement('div',{className:'web-actions'},[['↻','Reverse','Journaling','diary'],['✉','Future','Self','diary'],['♫','Music','For You','tingle'],['▣','Movie','For You','tingle'],['▤','Mood','Report','insight'],['♧','Support','Circle','safety'],['♢','Emergency','Alert','safety']].map(([ic,a,b,to])=>React.createElement('button',{key:a,onClick:()=>go(to)},React.createElement('span',null,ic),React.createElement('b',null,a),React.createElement('small',null,b))))),

      React.createElement('div',{id:'legacy-mount',className:'legacy-mount'}),
      React.createElement('footer',{className:'footer'},'SPIDEYTINGLe · BUILT FOR REFLECTION, NOT DIAGNOSIS · ✦ TEAM DATA DIVAS')
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
