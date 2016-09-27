<?php

final class SoftwareContent implements PageContent {
    private $_contentFilename;
    private $_image;
    private $_documentationFile;

    public function __construct($contentFilename, Asset $image, $documentationFile) {
        $this->_contentFilename = $contentFilename;
        $this->_image = $image;
        $this->_documentationFile = $documentationFile;
    }

    public function render(Page $page) {
        require 'template/content-software-wrapper.phtml';
    }

    private function headlineImage() {
        return $this->_image;
    }

    private function _renderMainContent(Page $page) {
        require 'template/' . $this->_contentFilename;
    }

    private function _documentation() {
        return new Documentation($this->_documentationFile);
    }

    private function _download($text, $item) {
        return '<a href="' . new Asset('downloads/' . $item) . '" >'
            . '<button type="submit" class="btn btn-primary">' . $text . '</button>'
            . '</a>';
    }
}
