---
layout: default
title: 장단콩 리그
---

<style>
  /* 데스크탑에서 이미지 최대 너비를 500px로 고정 */
  .carousel-inner img {
    max-width: 500px;
    height: auto;
    margin: 0 auto;
  }

  /* 모바일(화면 너비가 768px 이하)에서는 이미지가 화면 크기에 맞게 조정 */
  @media (max-width: 768px) {
    .carousel-inner img {
      max-width: 100%; /* 부모 컨테이너에 맞게 */
    }
  }

  /* 갤러리 2안 */

  @import url(https://fonts.googleapis.com/css?family=Quicksand:400,300);
    body{
        font-family: 'Quicksand', sans-serif;
    }
    .gal-container{
        padding: 12px;
    }
    .gal-item{
        overflow: hidden;
        padding: 3px;
    }
    .gal-item .box{
        height: 350px;
        overflow: hidden;
    }
    .box img{
        height: 100%;
        width: 100%;
        object-fit:cover;
        -o-object-fit:cover;
    }
    .gal-item a:focus{
        outline: none;
    }
    .gal-item a:after{
        content:"\e003";
        /* font-family: 'Glyphicons Halflings'; */
        opacity: 0;
        background-color: rgba(0, 0, 0, 0.75);
        position: absolute;
        right: 3px;
        left: 3px;
        top: 3px;
        bottom: 3px;
        text-align: center;
        line-height: 350px;
        /* font-size: 30px; */
        color: #fff;
        -webkit-transition: all 0.5s ease-in-out 0s;
        -moz-transition: all 0.5s ease-in-out 0s;
        transition: all 0.5s ease-in-out 0s;
    }
    .gal-item a:hover:after{
        opacity: 1;
    }
    .modal-open .gal-container .modal{
        background-color: rgba(0,0,0,0.4);
    }
    .modal-open .gal-item .modal-body{
        padding: 0px;
    }
    .modal-open .gal-item button.close{
        position: absolute;
        width: 25px;
        height: 25px;
        background-color: #000;
        opacity: 1;
        color: #fff;
        z-index: 999;
        right: -12px;
        top: -12px;
        border-radius: 50%;
        font-size: 15px;
        border: 2px solid #fff;
        line-height: 25px;
        -webkit-box-shadow: 0 0 1px 1px rgba(0,0,0,0.35);
        box-shadow: 0 0 1px 1px rgba(0,0,0,0.35);
    }
    .modal-open .gal-item button.close:focus{
        outline: none;
    }
    .modal-open .gal-item button.close span{
        position: relative;
        top: -3px;
        font-weight: lighter;
        text-shadow:none;
    }
    .gal-container .modal-dialogue{
        width: 80%;
    }
    .gal-container .description{
        position: relative;
        height: 40px;
        top: -40px;
        padding: 10px 25px;
        background-color: rgba(0,0,0,0.5);
        color: #fff;
        text-align: left;
    }
    .gal-container .description h4{
        margin:0px;
        font-size: 15px;
        font-weight: 300;
        line-height: 20px;
    }
    .gal-container .modal.fade .modal-dialog {
        -webkit-transform: scale(0.1);
        -moz-transform: scale(0.1);
        -ms-transform: scale(0.1);
        transform: scale(0.1);
        top: 100px;
        opacity: 0;
        -webkit-transition: all 0.3s;
        -moz-transition: all 0.3s;
        transition: all 0.3s;
    }

    .gal-container .modal.fade.in .modal-dialog {
        -webkit-transform: scale(1);
        -moz-transform: scale(1);
        -ms-transform: scale(1);
        transform: scale(1);
        -webkit-transform: translate3d(0, -100px, 0);
        transform: translate3d(0, -100px, 0);
        opacity: 1;
    }
    @media (min-width: 768px) {
    .gal-container .modal-dialog {
        width: 55%;
        margin: 50 auto;
    }
    }
    @media (max-width: 768px) {
        .gal-container .modal-content{
            height:250px;
        }
    }
    /* Footer Style */
    i.red{
        color:#BC0213;
    }
    .gal-container{
        padding-top :75px;
        padding-bottom:75px;
    }
    footer{
        font-family: 'Quicksand', sans-serif;
    }
    footer a,footer a:hover{
        color: #88C425;
    }
    .modal-backdrop.in {
    filter: alpha(opacity=50);
    opacity:0;
}
  
</style>

<!-- 캐러샐  -->
<div id="carouselExampleAutoplaying" class="carousel slide" data-bs-ride="carousel">
  <div class="carousel-inner">
    <div class="carousel-item active">
        <a href="https://www.jdkclub.click/infinity">
            <img src="/assets/img/infinityleague1.png" class="d-block img-fluid mx-auto" alt="1">
        </a>
    </div>
    <div class="carousel-item">
        <a href="https://www.jdkclub.click/conquest">
            <img src="/assets/img/infinityleague1.png" class="d-block img-fluid mx-auto" alt="2">
        </a>
    </div>
    <div class="carousel-item">
        <a href="https://www.jdkclub.click/infinity">
            <img src="/assets/img/infinityleague1.png" class="d-block img-fluid mx-auto" alt="3">
        </a>
    </div>
  </div>
  <button class="carousel-control-prev" type="button" data-bs-target="#carouselExampleAutoplaying" data-bs-slide="prev">
    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
    <span class="visually-hidden">이전</span>
  </button>
  <button class="carousel-control-next" type="button" data-bs-target="#carouselExampleAutoplaying" data-bs-slide="next">
    <span class="carousel-control-next-icon" aria-hidden="true"></span>
    <span class="visually-hidden">다음</span>
  </button>
</div>



<div id="contact" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
  <h1 class="pageTitle">장단콩 리그전</h1>
	<a></a>
</div>


<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.5.0/css/font-awesome.min.css">
<section>
  <div class="container gal-container">
    {% assign images = site.static_files | where_exp: "item", "item.path contains '/assets/img/league/'" %}
    {% for image in images %}
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#modal-{{ forloop.index }}">
          <img src="{{ image.path }}">
        </a>
        <div class="modal fade" id="modal-{{ forloop.index }}" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              <div class="modal-body">
                <img src="{{ image.path }}">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    {% endfor %}
  </div>
</section>