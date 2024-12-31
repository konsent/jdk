---
layout: default
title: 공식 이벤트
---

<!-- <div id="주요 이벤트">
  <h1>이벤트</h1>
  <ul class="posts noList">
    {%- for post in site.posts -%}
      {% if post.categories contains 'event' %}
        <li>
          <span class="date">{{ post.date | date_to_string }}</span>
          <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
          <p class="description">{%- if post.description -%}{{ post.description  | strip_html | strip_newlines | truncate: 120 }}{%- else -%}{{ post.content | strip_html | strip_newlines | truncate: 120 }}{%- endif -%}</p>
        </li>
      {% endif %}
    {%- endfor -%}
  </ul>
</div> -->

<!-- 썸네일 버전 -->
<!-- 스타일 -->
<style>
  .post-item {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
  }

  .post-thumbnail {
    width: 150px;  /* 너비와 높이를 동일하게 설정 */
    height: 150px;
    object-fit: cover;
    border-radius: 5px;
    border: 2px solid #000000; /* 3픽셀 두께의 검은색 테두리 추가 */
  }

  .post-info {
    flex: 1;
  }
  
  /* 캐러셀 스타일 */
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
</style>

<!-- 캐러셀 코드 추가 -->
<div id="carouselExampleAutoplaying" class="carousel slide" data-bs-ride="carousel">
  <div class="carousel-inner">
    <div class="carousel-item active">
        <a href="https://www.jdkclub.click/blog/25%EB%85%84%EC%9D%B8%ED%94%BC%EB%8B%88%ED%8B%B0%EB%A6%AC%EA%B7%B8/">
            <img src="/assets/img/infinityleague1.png" class="d-block img-fluid mx-auto" alt="1">
        </a>
    </div>
    <div class="carousel-item">
        <a href="https://www.jdkclub.click/blog/25%EB%85%84%EC%9D%B8%ED%94%BC%EB%8B%88%ED%8B%B0%EB%A6%AC%EA%B7%B8/">
            <img src="/assets/img/infinityleague1.png" class="d-block img-fluid mx-auto" alt="2">
        </a>
    </div>
    <div class="carousel-item">
        <a href="https://www.jdkclub.click/blog/25%EB%85%84%EC%9D%B8%ED%94%BC%EB%8B%88%ED%8B%B0%EB%A6%AC%EA%B7%B8/">
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
  <a></a>
  <h1 class="pageTitle">장단콩 리그전</h1>
  <a></a>
</div>




<!-- 코드 -->
<div id="주요 이벤트">
  <h1>이벤트</h1>
  <ul class="posts noList">
    {%- for post in site.posts -%}
      {% if post.categories contains 'event' %}
        <li>
          <div class="post-item">
            <a href="{{ post.url | relative_url }}">
              {% if post.thumbnail %}
                <img src="{{ post.thumbnail | relative_url }}" alt="{{ post.title }}" class="post-thumbnail">
              {% elsif post.image %}
                <img src="{{ post.image | relative_url }}" alt="{{ post.title }}" class="post-thumbnail">
              {% else %}
                <img src="/assets/img/jdk2.jpeg" alt="기본 썸네일" class="post-thumbnail">
              {% endif %}
            </a>
            <div class="post-info">
              <span class="date">{{ post.date | date: "%Y년 %m월 %d일" }}</span>
              <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
              <p class="description">{%- if post.description -%}{{ post.description  | strip_html | strip_newlines | truncate: 120 }}{%- else -%}{{ post.content | strip_html | strip_newlines | truncate: 120 }}{%- endif -%}</p>
            </div>
          </div>
        </li>
      {% endif %}
    {%- endfor -%}
  </ul>
</div>

