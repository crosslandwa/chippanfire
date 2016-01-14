<?php

final class SimpleContent {
    private $_contentFilename;
    private $_linkedPages;

    public function __construct($contentFilename, array $linkedPages = array()) {
        $this->_contentFilename = $contentFilename;
        $this->_linkedPages = $linkedPages;
    }

    public function render($page) {
        require 'template/' . $this->_contentFilename;
    }

    private function _pageLink($page, $altText = '') {
        if (isset($this->_linkedPages[$page])) {
            if ($altText) {
                return $this->_linkedPages[$page]->href()->withText($altText);
            }
            return $this->_linkedPages[$page]->href();
        }
        return $altText;
    }
}
