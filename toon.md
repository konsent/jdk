---
layout: default
title: 콩툰
---

<style>
  .post-item {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
  }

  .post-thumbnail {
    width: 300px;  /* 너비와 높이를 동일하게 설정 */
    height: 300px;
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


<!-- 코드 -->
<div id="콩툰">
  <h1>이벤트</h1>
  <ul class="posts noList">
    {%- for post in site.posts -%}
      {% if post.categories contains 'toon' %}
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

