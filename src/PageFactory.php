<?php

class PageFactory {
    public function software($linkedPages) {
        $title = 'Software';
        $href = 'software.html';

        return new Page($title, $href, new SoftwareHomeContent($linkedPages), Link::internal($title, $href));
    }
}