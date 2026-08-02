(() => {
  'use strict';

  function installReadabilityStyles() {
    if (document.getElementById('xcReadabilityStyles')) return;

    const style = document.createElement('style');
    style.id = 'xcReadabilityStyles';
    style.textContent = `
      :root{
        --muted:#475467;
        --text:#101828;
      }

      body{
        font-size:16px;
        line-height:1.5;
        text-rendering:optimizeLegibility;
      }

      p,.muted,.sub,.meta,.insight p,.sidebar-footer{
        line-height:1.55;
      }

      .content{
        max-width:1280px;
        padding-top:30px;
      }

      .topbar h1{
        font-size:1.5rem;
      }

      .section-title{
        margin-bottom:24px;
      }

      .section-title h2{
        font-size:1.85rem;
      }

      .section-title p{
        max-width:760px;
        font-size:1rem;
        line-height:1.55;
      }

      .card{
        padding:24px;
      }

      .card h3{
        font-size:1.18rem;
      }

      .card-head{
        margin-bottom:18px;
      }

      .sub{
        font-size:.94rem;
      }

      .meta{
        font-size:.9rem;
      }

      .field{
        gap:8px;
      }

      .field label{
        color:#344054;
        font-size:.9rem;
        font-weight:800;
      }

      .field input,
      .field select,
      .field textarea{
        min-height:48px;
        padding:12px 14px;
        border-color:#cfd5df;
        font-size:1rem;
        line-height:1.35;
      }

      .field textarea{
        min-height:120px;
      }

      .primary,.secondary,.ghost,.danger{
        min-height:44px;
        padding:11px 15px;
        font-size:.95rem;
      }

      .pill{
        min-height:32px;
        padding:7px 10px;
        font-size:.84rem;
      }

      .insight{
        padding:18px 18px 18px 20px;
      }

      .insight strong{
        font-size:1rem;
      }

      .insight p{
        font-size:.95rem;
      }

      .nav button{
        min-height:46px;
        font-size:.95rem;
      }

      .brand-copy strong{
        font-size:1.08rem;
      }

      .brand-copy span,
      .sidebar-footer{
        font-size:.86rem;
      }

      #settings > .grid-2{
        grid-template-columns:1fr;
        gap:20px;
      }

      #settings .card{
        width:100%;
      }

      #settings .form-grid{
        gap:16px;
      }

      #settings .xc-speech-btn,
      #settings .xc-speech-status{
        display:none!important;
      }

      #settings .xc-speech-wrap{
        display:block;
      }

      #settings .xc-speech-wrap > input,
      #settings .xc-speech-wrap > select,
      #settings .xc-speech-wrap > textarea{
        width:100%;
      }

      #settings .field.span-2 > div[style*="grid-template-columns"]{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        gap:12px!important;
      }

      #settings .field.span-2 > div[style*="grid-template-columns"] .pill{
        border:1px solid #d0d5dd;
        border-radius:12px;
        min-height:46px;
        background:#f8fafc;
        color:#344054;
        font-size:.94rem;
      }

      #settings .field.span-2 > div[style*="grid-template-columns"] input[type="checkbox"]{
        width:18px;
        height:18px;
      }

      .table th,.table td{
        font-size:.92rem;
        line-height:1.4;
      }

      .table th{
        font-size:.8rem;
      }

      @media(max-width:1100px){
        .content{
          padding-left:22px;
          padding-right:22px;
        }
      }

      @media(max-width:780px){
        body{
          font-size:17px;
        }

        .content{
          padding:20px 14px 108px;
        }

        .topbar{
          padding:14px 16px;
        }

        .topbar h1{
          font-size:1.32rem;
        }

        .section-title h2{
          font-size:1.65rem;
        }

        .section-title p{
          font-size:1rem;
        }

        .card{
          padding:18px;
          border-radius:16px;
        }

        .card h3{
          font-size:1.12rem;
        }

        .sub,.meta{
          font-size:.94rem;
        }

        .primary,.secondary,.ghost,.danger{
          width:100%;
          min-height:48px;
          font-size:1rem;
        }

        .toolbar{
          width:100%;
        }

        .toolbar .field{
          width:100%;
        }

        .field input,
        .field select,
        .field textarea{
          min-height:52px;
          font-size:16px;
        }

        #settings .field.span-2 > div[style*="grid-template-columns"]{
          grid-template-columns:1fr!important;
        }

        .mobile-nav button{
          font-size:.74rem;
          min-height:54px;
        }

        .mobile-nav span{
          font-size:1.25rem;
        }
      }

      @media(max-width:480px){
        .stats{
          grid-template-columns:1fr;
        }

        .section-title h2{
          font-size:1.55rem;
        }

        .card-head{
          align-items:flex-start;
          flex-direction:column;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installReadabilityStyles, { once:true });
  } else {
    installReadabilityStyles();
  }
})();
