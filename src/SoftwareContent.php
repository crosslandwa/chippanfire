<?php

final class SoftwareContent {
    private $_contentFilename;
    private $_image;

    public function __construct($contentFilename, $image) {
        $this->_contentFilename = $contentFilename;
        $this->_image = $image;
    }

    public function render($page) {
        require 'template/content-software-wrapper.phtml';
    }

    private function headlineImage() {
        return $this->_image;
    }

    private function _renderMainContent($page) {
        require 'template/' . $this->_contentFilename;
    }
}
