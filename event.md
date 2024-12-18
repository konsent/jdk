---
layout: default
title: 소식지
---

<div id="주요 이벤트">
  <h1>이벤트</h1>
  <ul class="posts noList">
    {%- for post in site.posts -%}
      {% if page.category == nil or page.category == "" %}
        <li>
          <span class="date">{{ post.date | date_to_string }}</span>
          <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
          <p class="description">{%- if post.description -%}{{ post.description  | strip_html | strip_newlines | truncate: 120 }}{%- else -%}{{ post.content | strip_html | strip_newlines | truncate: 120 }}{%- endif -%}</p>
        </li>
      {% endif %}
    {%- endfor -%}
  </ul>
</div>
