<?php

final class SoftwareSummary {
    private $_page;
    private $_content;

    public function __construct(Page $page, SoftwareContent $content) {
        $this->_page = $page;
        $this->_content = $content;
    }

    public function href() {
        return $this->_page->href();
    }

    public function headlineText() {
        return $this->_content->headlineText();
    }
}
