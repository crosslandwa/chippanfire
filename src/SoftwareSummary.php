<?php

final class SoftwareSummary {
    private $_link;
    private $_content;

    public function __construct(Link $link, SoftwareContent $content) {
        $this->_link = $link;
        $this->_content = $content;
    }

    public function href() {
        return $this->_link;
    }

    public function headlineText() {
        return $this->_content->headlineText();
    }
}
