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
  body {
      /* background-color: #1d1d1d !important;
      font-family: "Asap", sans-serif;
      color: #989898;
      margin: 10px;
      font-size: 16px; */
  }

  #demo {
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .green {
    background-color: #6fb936;
  }

  .thumb {
    margin-bottom: 30px;
  }

  .page-top {
    margin-top: 85px;
  }

  img.zoom {
    width: 100%;
    height: 200px;
    border-radius: 5px;
    object-fit: cover;
    -webkit-transition: all .3s ease-in-out;
    -moz-transition: all .3s ease-in-out;
    -o-transition: all .3s ease-in-out;
    -ms-transition: all .3s ease-in-out;
  }

  .transition {
    -webkit-transform: scale(1.2); 
    -moz-transform: scale(1.2);
    -o-transform: scale(1.2);
    transform: scale(1.2);
  }

  .modal-header {
    border-bottom: none;
  }

  .modal-title {
    color: #000;
  }

  .modal-footer {
    display: none;
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


<!-- 갤러리 -->
<!-- <div class="container page-top">
  <div class="row">
      <div class="col-lg-3 col-md-4 col-xs-6 thumb">
          <a href="https://images.pexels.com/photos/62307/air-bubbles-diving-underwater-blow-62307.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" class="fancybox" rel="ligthbox">
              <img  src="https://images.pexels.com/photos/62307/air-bubbles-diving-underwater-blow-62307.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" class="zoom img-fluid" alt=""> 
          </a>
      </div>
      <div class="col-lg-3 col-md-4 col-xs-6 thumb">
          <a href="https://images.pexels.com/photos/38238/maldives-ile-beach-sun-38238.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" class="fancybox" rel="ligthbox">
              <img src="https://images.pexels.com/photos/38238/maldives-ile-beach-sun-38238.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" class="zoom img-fluid" alt="">
          </a>
      </div>
      <div class="col-lg-3 col-md-4 col-xs-6 thumb">
          <a href="https://images.pexels.com/photos/158827/field-corn-air-frisch-158827.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" class="fancybox" rel="ligthbox">
              <img  src="https://images.pexels.com/photos/158827/field-corn-air-frisch-158827.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" class="zoom img-fluid" alt="">
          </a>
      </div>
      <div class="col-lg-3 col-md-4 col-xs-6 thumb">
          <a href="https://images.pexels.com/photos/302804/pexels-photo-302804.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" class="fancybox" rel="ligthbox">
              <img src="https://images.pexels.com/photos/302804/pexels-photo-302804.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" class="zoom img-fluid" alt="">
          </a>
      </div>
      <div class="col-lg-3 col-md-4 col-xs-6 thumb">
          <a href="https://images.pexels.com/photos/1038914/pexels-photo-1038914.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" class="fancybox" rel="ligthbox">
              <img  src="https://images.pexels.com/photos/1038914/pexels-photo-1038914.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" class="zoom img-fluid" alt="">
          </a>
      </div>
      <div class="col-lg-3 col-md-4 col-xs-6 thumb">
          <a href="https://images.pexels.com/photos/414645/pexels-photo-414645.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" class="fancybox" rel="ligthbox">
              <img  src="https://images.pexels.com/photos/414645/pexels-photo-414645.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" class="zoom img-fluid" alt="">
          </a>
      </div>
      <div class="col-lg-3 col-md-4 col-xs-6 thumb">
          <a href="https://images.pexels.com/photos/56005/fiji-beach-sand-palm-trees-56005.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" class="fancybox" rel="ligthbox">
              <img  src="https://images.pexels.com/photos/56005/fiji-beach-sand-palm-trees-56005.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" class="zoom img-fluid" alt="">
          </a>
      </div>
      <div class="col-lg-3 col-md-4 col-xs-6 thumb">
          <a href="https://images.pexels.com/photos/1038002/pexels-photo-1038002.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" class="fancybox" rel="ligthbox">
              <img  src="https://images.pexels.com/photos/1038002/pexels-photo-1038002.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" class="zoom img-fluid" alt="">
          </a>
      </div>
  </div>
</div> -->

<!-- 
jQuery 라이브러리
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
Fancybox JS
<script src="https://cdnjs.cloudflare.com/ajax/libs/fancybox/3.5.7/jquery.fancybox.min.js"></script>

 -->

<!-- 갤러리 2안 -->

<!-- <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.5.0/css/font-awesome.min.css">
<section>
  <div class="container gal-container">
    <div class="col-md-8 col-sm-12 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#1">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/1.jpg">
        </a>
        <div class="modal fade" id="1" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/1.jpg">
              </div>
                <div class="col-md-12 description">
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#2">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/2.jpg">
        </a>
        <div class="modal fade" id="2" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/2.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the second one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#3">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/3.jpg">
        </a>
        <div class="modal fade" id="3" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/3.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the third one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#4">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/4.jpg">
        </a>
        <div class="modal fade" id="4" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/4.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the fourth one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#5">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/5.jpg">
        </a>
        <div class="modal fade" id="5" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/5.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the fifth one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#6">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/6.jpg">
        </a>
        <div class="modal fade" id="6" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/6.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the sixth one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#7">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/7.jpg">
        </a>
        <div class="modal fade" id="7" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/7.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the seventh one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#8">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/8.jpg">
        </a>
        <div class="modal fade" id="8" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/8.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the eighth one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#9">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/9.jpg">
        </a>
        <div class="modal fade" id="9" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/9.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the ninth one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-8 col-sm-12 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#10">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/10.jpg">
        </a>
        <div class="modal fade" id="10" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/10.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the tenth one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#11">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/11.jpg">
        </a>
        <div class="modal fade" id="11" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/11.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the leventh one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#12">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/12.jpg">
        </a>
        <div class="modal fade" id="12" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/12.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the 12th one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#13">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/13.jpg">
        </a>
        <div class="modal fade" id="13" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/13.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the 13th one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#14">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/14.jpg">
        </a>
        <div class="modal fade" id="14" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/14.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the 14th one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#15">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/15.jpg">
        </a>
        <div class="modal fade" id="15" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/15.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the 15th one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-sm-6 co-xs-12 gal-item">
      <div class="box">
        <a href="#" data-toggle="modal" data-target="#16">
          <img src="http://nabeel.co.in/files/bootsnipp/gallery/16.jpg">
        </a>
        <div class="modal fade" id="16" tabindex="-1" role="dialog">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
              <div class="modal-body">
                <img src="http://nabeel.co.in/files/bootsnipp/gallery/16.jpg">
              </div>
                <div class="col-md-12 description">
                  <h4>This is the 16th one on my Gallery</h4>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section> -->

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