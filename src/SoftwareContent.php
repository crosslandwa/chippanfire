<?php

final class SoftwareContent {
    private $_contentFilename;
    private $_description;
    private $_image;

    public function __construct($contentFilename, $description, $image) {
        $this->_contentFilename = $contentFilename;
        $this->_description = $description;
        $this->_image = $image;
    }

    public function render($page) {
        require 'template/content-software-wrapper.phtml';
    }

    public function headlineText() {
        return $this->_description;
    }

    private function headlineImage() {
        return $this->_image;
    }

    private function _renderMainContent($page) {
        require 'template/' . $this->_contentFilename;
    }
}
